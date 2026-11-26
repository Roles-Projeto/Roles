// backend/utils/aprovacao.js
// Regras da aprovacao de cadastros (eventos e estabelecimentos).
//
// status_aprovacao:
//   pendente  -> acabou de ser cadastrado, esperando um admin decidir
//   aprovado  -> aparece nas listagens publicas
//   bloqueado -> recusado por um admin, nao aparece pro publico
//
// Fica separado da coluna "visibilidade" (publico/privado) de proposito:
// visibilidade e escolha do dono, aprovacao e decisao do admin.

const STATUS_APROVACAO = Object.freeze({
  PENDENTE: "pendente",
  APROVADO: "aprovado",
  BLOQUEADO: "bloqueado",
});

// Confere se quem fez a requisicao e admin. Depende de o token (middleware
// verificarToken) colocar o campo "role" em req.usuario.
function ehAdmin(usuario) {
  return !!usuario && usuario.role === "admin";
}

// Cadastro de admin ja entra aprovado; o de qualquer outra pessoa entra pendente.
function statusInicial(usuario) {
  return ehAdmin(usuario) ? STATUS_APROVACAO.APROVADO : STATUS_APROVACAO.PENDENTE;
}

module.exports = { STATUS_APROVACAO, ehAdmin, statusInicial };