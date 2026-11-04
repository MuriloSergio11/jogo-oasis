const socket = io();
let meuId = null;
let estadoAtual = { jogadores: [], fase: 'lobby', energia: 100, rodada: 0, maxJogadores: 5 };
let timerInterval = null;
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

// Pega os elementos
const $ = (id) => document.getElementById(id);
const telaEntrada = $('telaEntrada'), telaJogo = $('telaJogo'), gridAvatares = $('gridAvatares'), inputNome = $('inputNome'), btnEntrar = $('btnEntrar'), avisoEntrada = $('avisoEntrada'), energiaFill = $('energiaFill'), energiaValor = $('energiaValor'), energiaAlerta = $('energiaAlerta'), listaJogadores = $('listaJogadores'), metaPontos = $('metaPontos'), numRodada = $('numRodada'), areaLobby = $('areaLobby'), areaDesafio = $('areaDesafio'), lobbyInfo = $('lobbyInfo'), btnIniciar = $('btnIniciar'), btnReiniciar = $('btnReiniciar'), desafioTipo = $('desafioTipo'), desafioTema = $('desafioTema'), desafioTimer = $('desafioTimer'), desafioPergunta = $('desafioPergunta'), opcoesDesafio = $('opcoesDesafio'), btnDica = $('btnDica'), btnOg = $('btnOg'), mensagemRodada = $('mensagemRodada'), explicacaoCoop = $('explicacaoCoop'), chatMensagens = $('chatMensagens'), chatInput = $('chatInput'), btnEnviarChat = $('btnEnviarChat'), modalFim = $('modalFim'), modalEmoji = $('modalEmoji'), modalTitulo = $('modalTitulo'), modalMensagem = $('modalMensagem'), modalPlacarFinal = $('modalPlacarFinal'), btnJogarNovamente = $('btnJogarNovamente'), toast = $('toast');

// ==========================================
// CRIA OS AVATARES NA TELA
// ==========================================
function montarAvatares() {
  if(!gridAvatares) return;
  gridAvatares.innerHTML = '';
  Object.entries(AVATARES_LOCAL).forEach(([id, info]) => {
    const card = document.createElement('div');
    card.className = 'avatar-card' + (id === meuAvatarId ? ' selecionado' : '');
    card.innerHTML = `<span class="avatar-emoji">${info.emoji}</span><div class="avatar-nome">${info.nome}</div><div class="avatar-classe">${info.classe}</div><div class="avatar-hab">${info.hab}</div>`;
    card.addEventListener('click', () => { document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selecionado')); card.classList.add('selecionado'); meuAvatarId = id; });
    gridAvatares.appendChild(card);
  });
}
montarAvatares();

// ==========================================
// SISTEMA DE ENTRAR NO JOGO
// ==========================================
if(btnEntrar) {
  btnEntrar.addEventListener('click', () => {
    const nome = inputNome.value.trim();
    if (!nome) { mostrarAvisoEntrada('Digite um nome!'); return; }
    btnEntrar.disabled = true;
    btnEntrar.textContent = 'Conectando...';
    socket.emit('entrar', { nome, avatarId: meuAvatarId });
  });
}

function mostrarAvisoEntrada(msg) { 
  if(!avisoEntrada) return;
  avisoEntrada.textContent = '⚠️ ' + msg; 
  avisoEntrada.classList.remove('escondido'); 
  btnEntrar.disabled = false; 
  btnEntrar.textContent = '▶ Entrar no OASIS';
  setTimeout(() => avisoEntrada.classList.add('escondido'), 3500); 
}

socket.on('bemVindo', ({ id }) => { 
  meuId = id; 
  telaEntrada.classList.add('escondido');
  telaJogo.classList.remove('escondido');
});

// ==========================================
// ATUALIZA O JOGO (LOBBY, PLACAR, ETC)
// ==========================================
socket.on('estadoJogo', (estado) => {
  estadoAtual = estado;
  
  // Atualiza barras e placar
  atualizarEnergia(estado.energia);
  atualizarPlacar(estado.jogadores);
  if(metaPontos) metaPontos.textContent = estado.pontosVitoria + ' pts';
  if(numRodada) numRodada.textContent = estado.rodada;
  
  // Mostra o Lobby central ou a Pergunta
  if (estado.fase === 'lobby' || estado.fase === 'finalizado') {
    if(areaLobby) areaLobby.classList.remove('escondido'); 
    if(areaDesafio) areaDesafio.classList.add('escondido');
    if(lobbyInfo) lobbyInfo.innerHTML = `A sala tem <strong>${estado.jogadores.length} / ${estado.maxJogadores} jogadores</strong>.`;
    if(btnIniciar) btnIniciar.disabled = estado.jogadores.length < 2;
  } else if (estado.fase === 'jogando') { 
    if(areaLobby) areaLobby.classList.add('escondido'); 
  }
});

function atualizarEnergia(valor) {
  if(!energiaFill) return;
  energiaFill.style.width = valor + '%'; 
  if(energiaValor) energiaValor.textContent = valor + '%';
  energiaFill.classList.remove('media', 'baixa'); 
  if(energiaValor) energiaValor.style.color = '';
  if (valor <= 25) { energiaFill.classList.add('baixa'); if(energiaValor) energiaValor.style.color = 'var(--neon-red)'; if(energiaAlerta) energiaAlerta.classList.remove('escondido'); }
  else if (valor <= 60) { energiaFill.classList.add('media'); if(energiaValor) energiaValor.style.color = 'var(--neon-yellow)'; if(energiaAlerta) energiaAlerta.classList.add('escondido'); }
  else { if(energiaValor) energiaValor.style.color = 'var(--neon-green)'; if(energiaAlerta) energiaAlerta.classList.add('escondido'); }
}

function atualizarPlacar(jogadores) {
  if(!listaJogadores) return;
  listaJogadores.innerHTML = '';
  [...jogadores].sort((a, b) => b.pontos - a.pontos).forEach((j, idx) => {
    const li = document.createElement('li');
    if (idx === 0 && j.pontos > 0) li.classList.add('lider');
    if (j.id === meuId) li.classList.add('eu');
    li.innerHTML = `<span class="j-avatar">${j.avatarInfo ? j.avatarInfo.emoji : '🔷'}</span><div class="j-info"><div class="j-nome">${escapeHtml(j.nome)}</div></div><span class="j-pts">${j.pontos}</span>`;
    listaJogadores.appendChild(li);
  });
}

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

if(btnIniciar) btnIniciar.addEventListener('click', () => socket.emit('iniciarJogo'));
if(btnReiniciar) btnReiniciar.addEventListener('click', () => socket.emit('reiniciar'));

// ==========================================
// NOVA RODADA DE PERGUNTAS
// ==========================================
socket.on('novaRodada', (data) => {
  jaRespondi = false;
  if(areaLobby) areaLobby.classList.add('escondido'); 
  if(areaDesafio) areaDesafio.classList.remove('escondido');
  if(mensagemRodada) mensagemRodada.textContent = ''; 
  if(explicacaoCoop) { explicacaoCoop.classList.add('escondido'); explicacaoCoop.innerHTML = ''; }
  
  if(desafioTipo) {
    desafioTipo.textContent = data.tipo === 'individual' ? '🟣 DESAFIO INDIVIDUAL' : '🟢 DESAFIO COOPERATIVO';
    desafioTipo.className = 'tag-tipo ' + data.tipo;
  }
  if(desafioTema) desafioTema.textContent = data.tema || ''; 
  if(desafioPergunta) desafioPergunta.textContent = data.pergunta;
  
  if(opcoesDesafio) {
    opcoesDesafio.innerHTML = '';
    data.opcoes.forEach((opcao, idx) => {
      const btn = document.createElement('button'); btn.className = 'opcao';
      btn.innerHTML = `<span class="letra">${String.fromCharCode(65 + idx)}</span><span>${escapeHtml(opcao)}</span>`;
      btn.addEventListener('click', () => responder(idx)); opcoesDesafio.appendChild(btn);
    });
  }
  
  const meuJogador = estadoAtual.jogadores.find(j => j.id === meuId);
  if(btnDica) btnDica.classList.add('escondido'); 
  if(btnOg) btnOg.classList.add('escondido');
  
  if (meuJogador) {
    if (meuJogador.avatar === 'curator' && btnDica) { btnDica.classList.remove('escondido'); btnDica.disabled = false; }
    if (meuJogador.avatar === 'og' && !meuJogador.habilidadeUsada && data.tipo === 'individual' && btnOg) { btnOg.classList.remove('escondido'); btnOg.disabled = false; }
  }
  
  inicioPergunta = Date.now(); 
  iniciarTimer(data.duracao);
});

function iniciarTimer(segundos) {
  if (timerInterval) clearInterval(timerInterval);
  let restante = segundos; 
  if(desafioTimer) { desafioTimer.textContent = formatarTempo(restante); desafioTimer.classList.remove('urgente'); }
  timerInterval = setInterval(() => {
    restante--; 
    if(desafioTimer) {
      desafioTimer.textContent = formatarTempo(restante);
      if (restante <= 5) desafioTimer.classList.add('urgente');
    }
    if (restante <= 0) clearInterval(timerInterval);
  }, 1000);
}

function formatarTempo(s) { if (s < 0) s = 0; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

function responder(idx) {
  if (jaRespondi) return; jaRespondi = true;
  const tempoMs = Date.now() - inicioPergunta;
  document.querySelectorAll('.opcao').forEach((btn, i) => { btn.disabled = true; if (i === idx) btn.style.borderColor = 'var(--neon-cyan)'; });
  socket.emit('responder', { opcao: idx, tempoMs });
}

// ==========================================
// DICAS E HABILIDADES
// ==========================================
if(btnDica) btnDica.addEventListener('click', () => { socket.emit('pedirDica'); btnDica.disabled = true; });
socket.on('dica', ({ dica }) => { if(mensagemRodada) { mensagemRodada.textContent = '💡 Dica: ' + dica; mensagemRodada.style.color = 'var(--neon-yellow)'; } });

if(btnOg) btnOg.addEventListener('click', () => { socket.emit('usarHabilidadeOg'); btnOg.disabled = true; btnOg.classList.add('escondido'); });
socket.on('revelarResposta', ({ correta }) => { mostrarToast('🔮 Visão revelada!'); const btn = document.querySelectorAll('.opcao')[correta]; if (btn) btn.style.borderColor = 'var(--neon-green)'; });
socket.on('ogUsouHabilidade', ({ nome }) => { mostrarToast(`🔮 ${nome} usou a Visão do Oráculo!`); });

// ==========================================
// RESULTADO DA RODADA
// ==========================================
socket.on('resultadoRodada', (r) => {
  if (timerInterval) clearInterval(timerInterval);
  document.querySelectorAll('.opcao').forEach((btn, i) => {
    btn.disabled = true;
    if (i === r.respostaCorreta) btn.classList.add('certa');
    else if (i === (r.opcaoEscolhida ?? r.opcaoMaisVotada) && !(r.acertou || r.acertouColetivo)) btn.classList.add('errada');
  });
  
  if(mensagemRodada) {
    if (r.tipo === 'individual') {
      mensagemRodada.textContent = r.mensagem; mensagemRodada.style.color = r.vencedor ? 'var(--neon-green)' : 'var(--neon-red)';
      if (r.rouboInfo) mensagemRodada.textContent += ` (💥 Roubou ${r.rouboInfo.pontos} pts de ${r.rouboInfo.de})`;
    } else {
      mensagemRodada.textContent = r.mensagem; mensagemRodada.style.color = r.acertouColetivo ? 'var(--neon-green)' : 'var(--neon-red)';
    }
  }
  
  if (r.tipo === 'cooperativo' && r.explicacao && explicacaoCoop) { 
    explicacaoCoop.innerHTML = `<strong>Por quê?</strong> ${escapeHtml(r.explicacao)}`; explicacaoCoop.classList.remove('escondido'); 
  }
  atualizarEnergia(r.energia); atualizarPlacar(r.jogadores);
});

// ==========================================
// FIM DE JOGO
// ==========================================
socket.on('fimDeJogo', (data) => {
  if (timerInterval) clearInterval(timerInterval);
  if(modalEmoji) modalEmoji.textContent = data.emoji; 
  if(modalTitulo) modalTitulo.textContent = data.titulo; 
  if(modalMensagem) modalMensagem.textContent = data.mensagem;
  if(modalPlacarFinal) {
    modalPlacarFinal.innerHTML = '';
    [...data.jogadores].sort((a, b) => b.pontos - a.pontos).forEach(j => {
      const row = document.createElement('div'); row.className = 'm-row';
      row.innerHTML = `<span>${j.avatarInfo ? j.avatarInfo.emoji : '🔷'} ${escapeHtml(j.nome)}</span><span class="m-pts">${j.pontos} pts</span>`;
      modalPlacarFinal.appendChild(row);
    });
  }
  if(modalFim) modalFim.classList.remove('escondido');
});

if(btnJogarNovamente) btnJogarNovamente.addEventListener('click', () => { modalFim.classList.add('escondido'); socket.emit('reiniciar'); });
socket.on('jogoReiniciado', () => { 
  if(modalFim) modalFim.classList.add('escondido'); 
  if(areaDesafio) areaDesafio.classList.add('escondido'); 
  if(areaLobby) areaLobby.classList.remove('escondido'); 
  if(mensagemRodada) mensagemRodada.textContent = ''; 
  if(explicacaoCoop) explicacaoCoop.classList.add('escondido'); 
});

// ==========================================
// NOTIFICAÇÕES E CHAT
// ==========================================
socket.on('erro', (msg) => { mostrarToast('⚠️ ' + msg); });
function mostrarToast(msg) { if(!toast) return; toast.textContent = msg; toast.classList.remove('escondido'); clearTimeout(window._toastTimer); window._toastTimer = setTimeout(() => toast.classList.add('escondido'), 4000); }
socket.on('energiaMudou', ({ delta, motivo }) => { const sinal = delta > 0 ? '+' : ''; mostrarToast(`⚡ Energia ${sinal}${delta}% — ${motivo}`); });

if(btnEnviarChat) btnEnviarChat.addEventListener('click', enviarChat);
if(chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarChat(); });
function enviarChat() { 
  if(!chatInput) return;
  const texto = chatInput.value.trim(); if (!texto) return; 
  socket.emit('chat', { texto }); chatInput.value = ''; 
}
socket.on('chatMsg', ({ nome, avatar, texto }) => {
  if(!chatMensagens) return;
  const div = document.createElement('div'); div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-nome">${avatar} ${escapeHtml(nome)}:</span>${escapeHtml(texto)}`;
  chatMensagens.appendChild(div); chatMensagens.scrollTop = chatMensagens.scrollHeight;
});
socket.on('jogoIniciado', () => { if(chatMensagens) chatMensagens.innerHTML = ''; mostrarToast('🎮 A partida começou!'); });
