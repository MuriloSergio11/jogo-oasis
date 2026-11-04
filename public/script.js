const socket = io();

// ============================================================
// ESTADO LOCAL
// ============================================================
let meuId = null;
let estadoAtual = null;
let timerInterval = null;
let perguntaAtual = null;
let jaRespondi = false;
let inicioPergunta = 0;
let meuAvatarId = 'parzival';

const AVATARES_LOCAL = {
  parzival: { emoji: '🛡️', nome: 'Parzival', classe: 'Guardião', hab: 'Escudo de Gelo' },
  art3mis:  { emoji: '⚡', nome: 'Art3mis', classe: 'Velocista', hab: 'Reflexo Rápido' },
  curator:  { emoji: '🧠', nome: 'Curator', classe: 'Sábio', hab: 'Memória do OASIS' },
  irok:     { emoji: '💥', nome: 'I-R0k', classe: 'Caótico', hab: 'Sabotagem' },
  og:       { emoji: '🔮', nome: 'Og', classe: 'Oráculo', hab: 'Visão' }
};

// ============================================================
// ELEMENTOS DO DOM
// ============================================================
const $ = (id) => document.getElementById(id);
const telaEntrada = $('telaEntrada');
const telaJogo = $('telaJogo');
const gridAvatares = $('gridAvatares');
const inputNome = $('inputNome');
const btnEntrar = $('btnEntrar');
const avisoEntrada = $('avisoEntrada');
const energiaFill = $('energiaFill');
const energiaValor = $('energiaValor');
const energiaAlerta = $('energiaAlerta');
const listaJogadores = $('listaJogadores');
const metaPontos = $('metaPontos');
const numRodada = $('numRodada');
const areaLobby = $('areaLobby');
const areaDesafio = $('areaDesafio');
const lobbyInfo = $('lobbyInfo');
const btnIniciar = $('btnIniciar');
const btnReiniciar = $('btnReiniciar');
const desafioTipo = $('desafioTipo');
const desafioTema = $('desafioTema');
const desafioTimer = $('desafioTimer');
const desafioPergunta = $('desafioPergunta');
const opcoesDesafio = $('opcoesDesafio');
const btnDica = $('btnDica');
const btnOg = $('btnOg');
const mensagemRodada = $('mensagemRodada');
const explicacaoCoop = $('explicacaoCoop');
const chatMensagens = $('chatMensagens');
const chatInput = $('chatInput');
const btnEnviarChat = $('btnEnviarChat');
const modalFim = $('modalFim');
const modalEmoji = $('modalEmoji');
const modalTitulo = $('modalTitulo');
const modalMensagem = $('modalMensagem');
const modalPlacarFinal = $('modalPlacarFinal');
const btnJogarNovamente = $('btnJogarNovamente');
const toast = $('toast');

// ============================================================
// MONTAR GRID DE AVATARES
// ============================================================
function montarAvatares() {
  gridAvatares.innerHTML = '';
  Object.entries(AVATARES_LOCAL).forEach(([id, info]) => {
    const card = document.createElement('div');
    card.className = 'avatar-card' + (id === meuAvatarId ? ' selecionado' : '');
    card.dataset.id = id;
    card.innerHTML = `
      <span class="avatar-emoji">${info.emoji}</span>
      <div class="avatar-nome">${info.nome}</div>
      <div class="avatar-classe">${info.classe}</div>
      <div class="avatar-hab">${info.hab}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selecionado'));
      card.classList.add('selecionado');
      meuAvatarId = id;
    });
    gridAvatares.appendChild(card);
  });
}
montarAvatares();

// ============================================================
// ENTRAR NO JOGO
// ============================================================
btnEntrar.addEventListener('click', () => {
  const nome = inputNome.value.trim();
  if (!nome) {
    mostrarAvisoEntrada('Digite um nome!');
    return;
  }
  socket.emit('entrar', { nome, avatarId: meuAvatarId });
});

inputNome.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnEntrar.click();
});

function mostrarAvisoEntrada(msg) {
  avisoEntrada.textContent = '⚠️ ' + msg;
  avisoEntrada.classList.remove('escondido');
  setTimeout(() => avisoEntrada.classList.add('escondido'), 3500);
}

// ============================================================
// BEM-VINDO (entrou na sala)
// ============================================================
socket.on('bemVindo', ({ id }) => {
  meuId = id;
  telaEntrada.classList.remove('ativa');
  telaJogo.classList.add('ativa');
});

// ============================================================
// ESTADO DO JOGO (vem do servidor)
// ============================================================
socket.on('estadoJogo', (estado) => {
  estadoAtual = estado;

  atualizarEnergia(estado.energia);
  atualizarPlacar(estado.jogadores);

  metaPontos.textContent = estado.pontosVitoria + ' pts';
  numRodada.textContent = estado.rodada;

  if (estado.fase === 'lobby' || estado.fase === 'finalizado') {
    areaLobby.classList.remove('escondido');
    areaDesafio.classList.add('escondido');
    lobbyInfo.innerHTML = `A sala tem <strong>${estado.jogadores.length} jogador(es)</strong>.`;
    btnIniciar.disabled = estado.jogadores.length < 2;
  } else if (estado.fase === 'jogando') {
    areaLobby.classList.add('escondido');
  }
});

function atualizarEnergia(valor) {
  energiaFill.style.width = valor + '%';
  energiaValor.textContent = valor + '%';

  energiaFill.classList.remove('media', 'baixa');
  energiaValor.style.color = '';

  if (valor <= 25) {
    energiaFill.classList.add('baixa');
    energiaValor.style.color = 'var(--vermelho)';
    energiaAlerta.classList.remove('escondido');
  } else if (valor <= 60) {
    energiaFill.classList.add('media');
    energiaValor.style.color = 'var(--amarelo)';
    energiaAlerta.classList.add('escondido');
  } else {
    energiaValor.style.color = 'var(--verde)';
    energiaAlerta.classList.add('escondido');
  }
}

function atualizarPlacar(jogadores) {
  listaJogadores.innerHTML = '';
  const ordenados = [...jogadores].sort((a, b) => b.pontos - a.pontos);

  ordenados.forEach((j, idx) => {
    const li = document.createElement('li');
    if (idx === 0 && j.pontos > 0) li.classList.add('lider');
    if (j.id === meuId) li.classList.add('eu');

    li.innerHTML = `
      <span class="j-avatar">${j.avatarInfo ? j.avatarInfo.emoji : '🔷'}</span>
      <div class="j-info">
        <div class="j-nome">${escapeHtml(j.nome)}</div>
      </div>
      <span class="j-pts">${j.pontos}</span>
    `;
    listaJogadores.appendChild(li);
  });
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================
// BOTÕES DE CONTROLE
// ============================================================
btnIniciar.addEventListener('click', () => {
  socket.emit('iniciarJogo');
});

btnReiniciar.addEventListener('click', () => {
  socket.emit('reiniciar');
});

// ============================================================
// NOVA RODADA
// ============================================================
socket.on('novaRodada', (data) => {
  perguntaAtual = data;
  jaRespondi = false;
  areaLobby.classList.add('escondido');
  areaDesafio.classList.remove('escondido');
  mensagemRodada.textContent = '';
  explicacaoCoop.classList.add('escondido');
  explicacaoCoop.innerHTML = '';

  desafioTipo.textContent = data.tipo === 'individual' ? '🟣 DESAFIO INDIVIDUAL' : '🟢 DESAFIO COOPERATIVO';
  desafioTipo.className = 'tag-tipo ' + data.tipo;
  desafioTema.textContent = data.tema || '';
  desafioPergunta.textContent = data.pergunta;

  opcoesDesafio.innerHTML = '';
  data.opcoes.forEach((opcao, idx) => {
    const btn = document.createElement('button');
    btn.className = 'opcao';
    btn.innerHTML = `<span class="letra">${String.fromCharCode(65 + idx)}</span><span>${escapeHtml(opcao)}</span>`;
    btn.addEventListener('click', () => responder(idx));
    opcoesDesafio.appendChild(btn);
  });

  const meuJogador = estadoAtual.jogadores.find(j => j.id === meuId);
  btnDica.classList.add('escondido');
  btnOg.classList.add('escondido');

  if (meuJogador) {
    if (meuJogador.avatar === 'curator') {
      btnDica.classList.remove('escondido');
      btnDica.disabled = false;
    }
    if (meuJogador.avatar === 'og' && !meuJogador.habilidadeUsada && data.tipo === 'individual') {
      btnOg.classList.remove('escondido');
      btnOg.disabled = false;
    }
  }

  inicioPergunta = Date.now();
  iniciarTimer(data.duracao);
});

function iniciarTimer(segundos) {
  if (timerInterval) clearInterval(timerInterval);
  let restante = segundos;
  desafioTimer.textContent = formatarTempo(restante);
  desafioTimer.classList.remove('urgente');

  timerInterval = setInterval(() => {
    restante--;
    desafioTimer.textContent = formatarTempo(restante);
    if (restante <= 5) desafioTimer.classList.add('urgente');
    if (restante <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

function formatarTempo(s) {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

// ============================================================
// RESPONDER
// ============================================================
function responder(idx) {
  if (jaRespondi) return;
  jaRespondi = true;

  const tempoMs = Date.now() - inicioPergunta;

  document.querySelectorAll('.opcao').forEach((btn, i) => {
    btn.disabled = true;
    if (i === idx) btn.style.borderColor = 'var(--azul-neon)';
  });

  socket.emit('responder', { opcao: idx, tempoMs });
}

// ============================================================
// DICA E HABILIDADE OG
// ============================================================
btnDica.addEventListener('click', () => {
  socket.emit('pedirDica');
  btnDica.disabled = true;
});

socket.on('dica', ({ dica }) => {
  mensagemRodada.textContent = '💡 Dica: ' + dica;
  mensagemRodada.style.color = 'var(--amarelo)';
});

btnOg.addEventListener('click', () => {
  socket.emit('usarHabilidadeOg');
  btnOg.disabled = true;
  btnOg.classList.add('escondido');
});

socket.on('revelarResposta', ({ correta }) => {
  mostrarToast('🔮 Visão revelada! A resposta certa está destacada em verde.');
  const btn = document.querySelectorAll('.opcao')[correta];
  if (btn) btn.style.borderColor = 'var(--verde)';
});

socket.on('ogUsouHabilidade', ({ nome }) => {
  mostrarToast(`🔮 ${nome} usou a Visão do Oráculo!`);
});

// ============================================================
// RESULTADO DA RODADA
// ============================================================
socket.on('resultadoRodada', (r) => {
  if (timerInterval) clearInterval(timerInterval);

  document.querySelectorAll('.opcao').forEach((btn, i) => {
    btn.disabled = true;
    if (i === r.respostaCorreta) btn.classList.add('certa');
    else if (i === (r.opcaoEscolhida ?? r.opcaoMaisVotada) && !(r.acertou || r.acertouColetivo)) {
      btn.classList.add('errada');
    }
  });

  if (r.tipo === 'individual') {
    if (r.vencedor) {
      mensagemRodada.textContent = r.mensagem;
      mensagemRodada.style.color = 'var(--verde)';
    } else {
      mensagemRodada.textContent = r.mensagem;
      mensagemRodada.style.color = 'var(--vermelho)';
    }
    if (r.rouboInfo) {
      mensagemRodada.textContent += ` (💥 Roubou ${r.rouboInfo.pontos} pts de ${r.rouboInfo.de})`;
    }
  } else {
    mensagemRodada.textContent = r.mensagem;
    mensagemRodada.style.color = r.acertouColetivo ? 'var(--verde)' : 'var(--vermelho)';

    if (r.explicacao) {
      explicacaoCoop.innerHTML = `<strong>Por quê?</strong> ${escapeHtml(r.explicacao)}`;
      explicacaoCoop.classList.remove('escondido');
    }
  }

  atualizarEnergia(r.energia);
  atualizarPlacar(r.jogadores);
});

// ============================================================
// FIM DE JOGO
// ============================================================
socket.on('fimDeJogo', (data) => {
  if (timerInterval) clearInterval(timerInterval);

  modalEmoji.textContent = data.emoji;
  modalTitulo.textContent = data.titulo;
  modalMensagem.textContent = data.mensagem;

  modalPlacarFinal.innerHTML = '';
  [...data.jogadores].sort((a, b) => b.pontos - a.pontos).forEach(j => {
    const row = document.createElement('div');
    row.className = 'm-row';
    row.innerHTML = `
      <span>${j.avatarInfo ? j.avatarInfo.emoji : '🔷'} ${escapeHtml(j.nome)}</span>
      <span class="m-pts">${j.pontos} pts</span>
    `;
    modalPlacarFinal.appendChild(row);
  });

  modalFim.classList.remove('escondido');
});

btnJogarNovamente.addEventListener('click', () => {
  modalFim.classList.add('escondido');
  socket.emit('reiniciar');
});

// ============================================================
// JOGO REINICIADO
// ============================================================
socket.on('jogoReiniciado', () => {
  modalFim.classList.add('escondido');
  areaDesafio.classList.add('escondido');
  areaLobby.classList.remove('escondido');
  mensagemRodada.textContent = '';
  explicacaoCoop.classList.add('escondido');
});

// ============================================================
// ERRO / TOAST
// ============================================================
socket.on('erro', (msg) => {
  mostrarToast('⚠️ ' + msg);
});

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('escondido');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('escondido'), 4000);
}

socket.on('energiaMudou', ({ delta, motivo }) => {
  const sinal = delta > 0 ? '+' : '';
  mostrarToast(`⚡ Energia ${sinal}${delta}% — ${motivo}`);
});

// ============================================================
// CHAT
// ============================================================
btnEnviarChat.addEventListener('click', enviarChat);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') enviarChat();
});

function enviarChat() {
  const texto = chatInput.value.trim();
  if (!texto) return;
  socket.emit('chat', { texto });
  chatInput.value = '';
}

socket.on('chatMsg', ({ nome, avatar, texto }) => {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-nome">${avatar} ${escapeHtml(nome)}:</span>${escapeHtml(texto)}`;
  chatMensagens.appendChild(div);
  chatMensagens.scrollTop = chatMensagens.scrollHeight;
});

// ============================================================
// JOGO INICIADO
// ============================================================
socket.on('jogoIniciado', () => {
  chatMensagens.innerHTML = '';
  mostrarToast('🎮 A partida começou!');
});
