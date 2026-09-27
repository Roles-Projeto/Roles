// backend/controllers/assentosController.js
const db = require("../db/db_config");

const MINUTOS_RESERVA = 10;

// =====================================================
// GERAR GRADE DE ASSENTOS
// Chamada internamente (não é uma rota) sempre que um ingresso é
// criado com tipo_selecao = 'numerado'. Usa generate_series do
// Postgres pra criar todos os assentos (fileira x número) numa
// única query, em vez de montar um INSERT gigante linha por linha.
//
// Recebe "tx" (o objeto de transação de db.transacao) para que a
// criação dos assentos aconteça na MESMA transação que criou o
// ingresso — se algo falhar depois, tudo é revertido junto.
// =====================================================
async function gerarAssentosParaIngresso(tx, ingressoId, fileiras, assentosPorFileira) {
  const f = parseInt(fileiras, 10);
  const a = parseInt(assentosPorFileira, 10);
  if (!f || f <= 0 || !a || a <= 0) {
    throw new Error("Fileiras e assentos por fileira precisam ser números positivos.");
  }

  await tx.query(
    `INSERT INTO assentos (ingresso_id, fileira, numero, status)
     SELECT ?, fil, num, 'disponivel'
     FROM generate_series(1, ?) AS fil
     CROSS JOIN generate_series(1, ?) AS num`,
    [ingressoId, f, a]
  );
}

// =====================================================
// LISTAR ASSENTOS DE UM INGRESSO (com status calculado)
// GET /assentos/:ingressoId
//
// Cada assento volta com um status "efetivo":
//   vendido              -> já foi comprado
//   reservado             -> tem reserva ativa de OUTRA pessoa
//   reservado_por_voce   -> tem reserva ativa do próprio usuário logado
//   disponivel           -> livre (inclui reservas já expiradas)
// =====================================================
exports.listarAssentosPorIngresso = async (req, res) => {
  try {
    const { ingressoId } = req.params;
    const usuarioId = req.usuario?.id || null;

    const assentos = await db.query(
      `SELECT a.id, a.fileira, a.numero, a.status,
              r.usuario_id AS reservado_por, r.expira_em AS reserva_expira_em
       FROM assentos a
       LEFT JOIN reservas_assento r
         ON r.assento_id = a.id AND r.expira_em > NOW()
       WHERE a.ingresso_id = ?
       ORDER BY a.fileira, a.numero`,
      [ingressoId]
    );

    const resultado = assentos.map((a) => {
      let statusEfetivo = "disponivel";
      if (a.status === "vendido") {
        statusEfetivo = "vendido";
      } else if (a.reservado_por != null) {
        statusEfetivo = String(a.reservado_por) === String(usuarioId)
          ? "reservado_por_voce"
          : "reservado";
      }
      return {
        id: a.id,
        fileira: a.fileira,
        numero: a.numero,
        status: statusEfetivo,
        reserva_expira_em: a.reserva_expira_em || null,
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error("Erro ao listar assentos:", err);
    res.status(500).json({ erro: "Erro ao listar assentos.", detalhes: err.message });
  }
};

// =====================================================
// RESERVAR UM ASSENTO (operação atômica)
// POST /assentos/:id/reservar
// Exige login.
//
// O SELECT ... FOR UPDATE trava a linha do assento até a transação
// terminar. Se duas pessoas clicarem no mesmo assento ao mesmo
// tempo, a segunda requisição espera a primeira terminar (commit
// ou rollback) antes de rodar sua própria checagem — não existe
// brecha onde as duas passam pela checagem "está livre?" juntas.
// =====================================================
exports.reservarAssento = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario?.id;
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const resultado = await db.transacao(async (tx) => {
      const linhas = await tx.query(
        "SELECT id, status FROM assentos WHERE id = ? FOR UPDATE",
        [id]
      );
      if (!linhas.length) {
        const erro = new Error("Assento não encontrado.");
        erro.status = 404;
        throw erro;
      }

      if (linhas[0].status === "vendido") {
        const erro = new Error("Este assento já foi vendido.");
        erro.status = 409;
        throw erro;
      }

      const reservasAtivas = await tx.query(
        `SELECT usuario_id FROM reservas_assento
         WHERE assento_id = ? AND expira_em > NOW()`,
        [id]
      );
      const reservaDeOutraPessoa = reservasAtivas.find(
        (r) => String(r.usuario_id) !== String(usuarioId)
      );
      if (reservaDeOutraPessoa) {
        const erro = new Error("Este assento já está sendo reservado por outra pessoa.");
        erro.status = 409;
        throw erro;
      }

      // Remove uma reserva anterior do próprio usuário para esse assento
      // (ex: ele clicou, saiu, voltou e clicou de novo) antes de criar a nova
      await tx.query(
        "DELETE FROM reservas_assento WHERE assento_id = ? AND usuario_id = ?",
        [id, usuarioId]
      );

      const expiraEm = new Date(Date.now() + MINUTOS_RESERVA * 60 * 1000);
      await tx.query(
        "INSERT INTO reservas_assento (assento_id, usuario_id, expira_em) VALUES (?, ?, ?)",
        [id, usuarioId, expiraEm.toISOString()]
      );

      return { assentoId: Number(id), expiraEm: expiraEm.toISOString() };
    });

    res.json({
      mensagem: "Assento reservado.",
      ...resultado,
      expiraEmMinutos: MINUTOS_RESERVA,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message });
    console.error("Erro ao reservar assento:", err);
    res.status(500).json({ erro: "Erro ao reservar assento.", detalhes: err.message });
  }
};

// =====================================================
// LIBERAR A PRÓPRIA RESERVA
// DELETE /assentos/:id/reservar
// Usado quando o comprador desiste ou troca de assento antes de
// finalizar a compra. Só apaga reserva do PRÓPRIO usuário logado —
// não deixa ninguém liberar reserva de outra pessoa.
// =====================================================
exports.liberarReserva = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario?.id;
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    await db.query(
      "DELETE FROM reservas_assento WHERE assento_id = ? AND usuario_id = ?",
      [id, usuarioId]
    );
    res.json({ mensagem: "Reserva liberada." });
  } catch (err) {
    console.error("Erro ao liberar reserva:", err);
    res.status(500).json({ erro: "Erro ao liberar reserva.", detalhes: err.message });
  }
};

// =====================================================
// CONFIRMAR ASSENTO COMO VENDIDO (helper interno)
// Não é uma rota própria — vai ser chamada de dentro do fluxo de
// finalização de compra (ingressosController), quando esse fluxo
// for atualizado para suportar ingressos numerados. Recebe "tx"
// para rodar na mesma transação que grava a venda.
// =====================================================
async function confirmarAssentoVendido(tx, assentoId) {
  await tx.query("UPDATE assentos SET status = 'vendido' WHERE id = ?", [assentoId]);
  await tx.query("DELETE FROM reservas_assento WHERE assento_id = ?", [assentoId]);
}

// =====================================================
// LIMPEZA DE RESERVAS EXPIRADAS (manutenção, não afeta corretude)
// Como o status "reservado" já é calculado por expira_em > NOW() em
// toda consulta, essa limpeza NÃO é necessária pro sistema funcionar
// direito — é só pra tabela reservas_assento não crescer para sempre
// com lixo de reservas antigas. Pode ser chamada por um cron/setInterval.
// =====================================================
exports.limparReservasExpiradas = async () => {
  try {
    await db.query("DELETE FROM reservas_assento WHERE expira_em < NOW()");
  } catch (err) {
    console.error("Erro ao limpar reservas expiradas:", err);
  }
};

exports.gerarAssentosParaIngresso = gerarAssentosParaIngresso;
exports.confirmarAssentoVendido = confirmarAssentoVendido;