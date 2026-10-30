// backend/controllers/assentosController.js
const db = require("../db/db_config");

const MINUTOS_RESERVA = 10;

// Erro com status HTTP, para as rotas responderem 400/404/409 em vez de 500
function erroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

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
//
// Para "reservado_por_voce" funcionar, a rota precisa de um middleware de
// token OPCIONAL (que preenche req.usuario quando há token, sem bloquear
// quem não está logado).
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
//
// Também aplica, no servidor, os limites configurados no ingresso:
//   - quantidade_max_por_compra: quantos assentos a pessoa pode segurar ao mesmo tempo
//   - limite_por_cpf: total por CPF, somando o que já foi retirado + o que está reservado
// =====================================================
exports.reservarAssento = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario?.id;
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const resultado = await db.transacao(async (tx) => {
      const linhas = await tx.query(
        "SELECT id, status, ingresso_id FROM assentos WHERE id = ? FOR UPDATE",
        [id]
      );
      if (!linhas.length) throw erroHttp(404, "Assento não encontrado.");

      if (linhas[0].status === "vendido") {
        throw erroHttp(409, "Este assento já foi vendido.");
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
        throw erroHttp(409, "Este assento já está sendo reservado por outra pessoa.");
      }

      // ── Limites do ingresso ──────────────────────────
      const ingressoId = linhas[0].ingresso_id;
      const ingRows = await tx.query("SELECT * FROM ingressos WHERE id = ?", [ingressoId]);
      const ingresso = ingRows[0];

      const maxPorCompra = Number(ingresso?.quantidade_max_por_compra) || 0;
      const limiteCpf = Number(ingresso?.limite_por_cpf) || (ingresso?.limite_um_por_cpf ? 1 : 0);

      if (maxPorCompra > 0 || limiteCpf > 0) {
        // Assentos deste ingresso que a pessoa já está segurando (fora este)
        const seguradosRows = await tx.query(
          `SELECT COUNT(*) AS total
           FROM reservas_assento r
           JOIN assentos a ON a.id = r.assento_id
           WHERE a.ingresso_id = ? AND r.usuario_id = ?
             AND r.expira_em > NOW() AND r.assento_id <> ?`,
          [ingressoId, usuarioId, id]
        );
        const segurados = Number(seguradosRows[0]?.total) || 0;

        if (maxPorCompra > 0 && segurados + 1 > maxPorCompra) {
          throw erroHttp(409, `Você pode reservar no máximo ${maxPorCompra} assento(s) de "${ingresso.titulo}" por compra.`);
        }

        if (limiteCpf > 0) {
          const usuarioRows = await tx.query("SELECT cpf FROM usuarios WHERE id = ?", [usuarioId]);
          const cpf = usuarioRows[0]?.cpf;
          if (!cpf || !String(cpf).replace(/\D/g, "")) {
            throw erroHttp(400, "Para retirar este ingresso, cadastre seu CPF no seu perfil.");
          }

          const retiradosRows = await tx.query(
            `SELECT COALESCE(SUM(v.quantidade), 0) AS total
             FROM vendas v
             JOIN usuarios u ON u.id = v.usuario_id
             WHERE v.ingresso_id = ? AND u.cpf = ?
               AND v.status IN ('aprovado', 'cortesia')`,
            [ingressoId, cpf]
          );
          const jaRetirados = Number(retiradosRows[0]?.total) || 0;

          if (jaRetirados + segurados + 1 > limiteCpf) {
            const restam = Math.max(0, limiteCpf - jaRetirados);
            throw erroHttp(409, restam === 0
              ? `Este CPF já retirou o limite de ${limiteCpf} ingresso(s) de "${ingresso.titulo}".`
              : `Cada CPF pode retirar até ${limiteCpf} ingresso(s) de "${ingresso.titulo}". Você ainda pode reservar ${restam}.`);
          }
        }
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
// Não é uma rota própria — roda dentro da transação da compra
// (ingressosController.comprarIngresso). Guarda o pedido que ficou
// com o assento (coluna assentos.pedido_id — ver migração em
// migracao_assentos_pedido.sql).
// =====================================================
async function confirmarAssentoVendido(tx, assentoId, pedidoId = null) {
  await tx.query(
    "UPDATE assentos SET status = 'vendido', pedido_id = ? WHERE id = ?",
    [pedidoId, assentoId]
  );
  await tx.query("DELETE FROM reservas_assento WHERE assento_id = ?", [assentoId]);
}

// =====================================================
// VENDER ASSENTOS RESERVADOS (helper interno, dentro da transação da compra)
// Para cada assento: trava a linha, confere que é do ingresso comprado,
// que não foi vendido e que a reserva é DE QUEM ESTÁ COMPRANDO e ainda
// está valida. Só então marca como vendido. Qualquer falha lança erro com
// status HTTP e a transação inteira (pedido + vendas) é revertida.
// =====================================================
async function venderAssentosReservados(tx, { ingressoId, assentoIds, usuarioId, pedidoId }) {
  const ordenados = [...assentoIds].map(Number).sort((a, b) => a - b); // ordem fixa evita deadlock

  for (const assentoId of ordenados) {
    const linhas = await tx.query(
      "SELECT id, status, ingresso_id FROM assentos WHERE id = ? FOR UPDATE",
      [assentoId]
    );
    const assento = linhas[0];

    if (!assento || String(assento.ingresso_id) !== String(ingressoId)) {
      throw erroHttp(400, "Um dos assentos escolhidos não pertence a este ingresso.");
    }
    if (assento.status === "vendido") {
      throw erroHttp(409, "Um dos assentos escolhidos já foi vendido. Escolha outro.");
    }

    const reserva = await tx.query(
      `SELECT 1 AS ok FROM reservas_assento
       WHERE assento_id = ? AND usuario_id = ? AND expira_em > NOW()`,
      [assentoId, usuarioId]
    );
    if (!reserva.length) {
      throw erroHttp(409, "A reserva de um dos assentos expirou. Volte e escolha novamente.");
    }

    await confirmarAssentoVendido(tx, assentoId, pedidoId);
  }
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
exports.venderAssentosReservados = venderAssentosReservados;