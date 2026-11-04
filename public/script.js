const socket = io();
let meuId = null;
let estadoAtual = { jogadores: [], fase: 'lobby', energia: 100, rodada: 0, maxJogadores: 5 };
let timerInterval = null;
let jaRespondi = false;
let inicioPergunta = 0;
let meuAvatarId = 'parzival';

const AVATARES = {
  parzival: { emoji: '🛡️', nome: 'Parzival', classe: 'Guardião' },
  art3mis: { emoji: '⚡', nome: 'Art3mis', classe: 'Velocista' },
  curator: { emoji: '🧠', nome: 'Curator', classe: 'Sábio' },
  irok: { emoji: '💥', nome: 'I-R0k', classe: 'Caótico' },
  og: { emoji: '🔮', nome: 'Og', classe: 'Oráculo' }
};

const $ = (id) => document.getElementById(id);
const telaEntrada = $('telaEntrada'), telaJogo = $('telaJogo'), gridAvatares = $('gridAvatares'), inputNome = $('inputNome'), btnEntrar = $('btnEntrar'), listaJogadores = $('listaJogadores'), areaLobby = $('areaLobby'), areaDesafio = $('areaDesafio'), btnIniciar = $('btnIniciar'), desafioPergunta = $('desafioPergunta'), opcoesDesafio = $('opcoesDesafio'), energiaFill = $('energiaFill'), energiaValor = $('energiaValor'), toast = $('toast'), lobbyInfo = $('lobbyInfo'), modalFim = $('modalFim'), mensagemRodada = $('mensagemRodada');

function montarAvatares() {
  gridAvatares.innerHTML = '';
  Object.entries(AVATARES).forEach(([id, info]) => {
    const div = document.createElement('div');
    div.className = 'avatar-card' + (id === meuAvatarId ? ' selecionado' : '');
    div.innerHTML = `<span class="avatar-emoji">${info.emoji}</span><div class="avatar-nome">${info.nome}</div><div class="avatar-classe">${info.classe}</div>`;
    div.onclick = () => {
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selecionado'));
      div.classList.add('selecionado');
      meuAvatarId = id;
    };
    gridAvatares.appendChild(div);
  });
}
montarAvatares();

btnEntrar.onclick = () => {
  const nome = inputNome.value.trim();
  if (!nome) return alert('Digite um nome!');
  socket.emit('entrar', { nome, avatarId: meuAvatarId });
};

socket.on('bemVindo', ({ id }) => {
  meuId = id;
  telaEntrada.classList.add('escondido');
  telaJogo.classList.remove('escondido');
});

socket.on('estadoJogo', (estado) => {
  estadoAtual = estado;
  listaJogadores.innerHTML = '';
  [...estado.jogadores].sort((a,b) => b.pontos - a.pontos).forEach(j => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${j.avatarInfo.emoji}</span> <strong>${j.nome}</strong> <span style="margin-left:auto">${j.pontos} pts</span>`;
    listaJogadores.appendChild(li);
  });

  energiaValor.textContent = estado.energia + '%';
  energiaFill.style.width = estado.energia + '%';

  if (estado.fase === 'lobby' || estado.fase === 'finalizado') {
    areaLobby.classList.remove('escondido');
    areaDesafio.classList.add('escondido');
    lobbyInfo.innerHTML = `Jogadores: <strong>${estado.jogadores.length} / 5</strong>`;
    btnIniciar.disabled = estado.jogadores.length < 2;
  } else if (estado.fase === 'jogando') {
    areaLobby.classList.add('escondido');
    areaDesafio.classList.remove('escondido');
  }
});

btnIniciar.onclick = () => socket.emit('iniciarJogo');

socket.on('novaRodada', (data) => {
  jaRespondi = false;
  mensagemRodada.textContent = '';
  desafioPergunta.textContent = data.pergunta;
  opcoesDesafio.innerHTML = '';
  inicioPergunta = Date.now();

  data.opcoes.forEach((opcao, index) => {
    const btn = document.createElement('button');
    btn.className = 'opcao';
    btn.innerHTML = `<span class="letra">${String.fromCharCode(65 + index)}</span> ${opcao}`;
    btn.onclick = () => {
      if (jaRespondi) return;
      jaRespondi = true;
      document.querySelectorAll('.opcao').forEach(b => b.disabled = true);
      btn.style.borderColor = 'var(--neon-cyan)';
      socket.emit('responder', { opcao: index, tempoMs: Date.now() - inicioPergunta });
    };
    opcoesDesafio.appendChild(btn);
  });
});

socket.on('resultadoRodada', (res) => {
  mensagemRodada.textContent = res.mensagem;
  const botoes = document.querySelectorAll('.opcao');
  if (botoes.length > 0) {
    botoes.forEach((b, i) => {
      b.disabled = true;
      if (i === res.respostaCorreta) b.style.borderColor = 'var(--neon-green)';
    });
  }
});

socket.on('fimDeJogo', (data) => {
  $('modalEmoji').textContent = data.emoji;
  $('modalTitulo').textContent = data.titulo;
  $('modalMensagem').textContent = data.mensagem;
  modalFim.classList.remove('escondido');
});

socket.on('erro', (msg) => {
  toast.textContent = msg;
  toast.classList.remove('escondido');
  setTimeout(() => toast.classList.add('escondido'), 3000);
});

// Chat
document.getElementById('btnEnviarChat').onclick = () => {
  const input = document.getElementById('chatInput');
  if (input.value.trim()) {
    socket.emit('chat', { texto: input.value.trim() });
    input.value = '';
  }
};

socket.on('chatMsg', (data) => {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-nome">${data.avatar} ${data.nome}:</span> ${data.texto}`;
  document.getElementById('chatMensagens').appendChild(div);
  document.getElementById('chatMensagens').scrollTop = 9999;
});
