const socket = io();
let usuarioLogado = null;
let avatarSelecionado = 'parzival';

const AVATARES = {
  parzival: { emoji: '🛡️', nome: 'Parzival' }, art3mis: { emoji: '⚡', nome: 'Art3mis' },
  curator: { emoji: '🧠', nome: 'Curator' }, irok: { emoji: '💥', nome: 'I-R0k' }, og: { emoji: '🔮', nome: 'Og' }
};

const $ = (id) => document.getElementById(id);

// ==========================================
// TROCAS DE TELAS (LOGIN <-> CADASTRO)
// ==========================================
$('btnIrParaCadastro').onclick = () => {
  $('telaLogin').classList.add('escondido');
  $('telaCadastro').classList.remove('escondido');
};

$('btnVoltarLogin').onclick = () => {
  $('telaCadastro').classList.add('escondido');
  $('telaLogin').classList.remove('escondido');
};

// ==========================================
// AÇÃO DE LOGAR
// ==========================================
$('btnFazerLogin').onclick = () => {
  const u = $('inputLoginUser').value.trim();
  const p = $('inputLoginPass').value.trim();
  if (!u || !p) return mostrarAviso('avisoLogin', 'Preencha usuário e senha.');
  socket.emit('login', { usuario: u, senha: p });
};

// ==========================================
// AÇÃO DE CADASTRAR
// ==========================================
$('btnConfirmarCadastro').onclick = () => {
  const u = $('inputCadUser').value.trim();
  const p = $('inputCadPass').value.trim();
  if (!u || !p) return mostrarAviso('avisoCadastro', 'Preencha todos os campos.');
  socket.emit('cadastrar', { usuario: u, senha: p });
};

function mostrarAviso(idElemento, msg) {
  const aviso = $(idElemento);
  aviso.textContent = '⚠️ ' + msg;
  aviso.classList.remove('escondido');
  setTimeout(() => aviso.classList.add('escondido'), 3000);
}

// ==========================================
// RESPOSTAS DO SERVIDOR (LOGIN E CADASTRO)
// ==========================================
socket.on('loginSucesso', (data) => {
  usuarioLogado = data.usuario;
  avatarSelecionado = data.avatar || 'parzival';
  
  $('boasVindasNome').innerHTML = `Bem-vindo, <strong>${usuarioLogado}</strong>!`;
  $('telaLogin').classList.add('escondido');
  $('telaCadastro').classList.add('escondido');
  $('telaAvatar').classList.remove('escondido');
  
  montarAvatares();
});

socket.on('erroLogin', (msg) => mostrarAviso('avisoLogin', msg));

socket.on('cadastroSucesso', () => {
  mostrarAviso('avisoCadastro', '✅ Conta criada! Voltando para o login...');
  setTimeout(() => {
    $('inputLoginUser').value = $('inputCadUser').value;
    $('inputLoginPass').value = $('inputCadPass').value;
    $('telaCadastro').classList.add('escondido');
    $('telaLogin').classList.remove('escondido');
  }, 2000);
});

socket.on('erroCadastro', (msg) => mostrarAviso('avisoCadastro', msg));

// ==========================================
// ESCOLHA DE AVATAR E ENTRAR NA SALA
// ==========================================
function montarAvatares() {
  const grid = $('gridAvatares');
  grid.innerHTML = '';
  Object.entries(AVATARES).forEach(([id, info]) => {
    const div = document.createElement('div');
    div.className = 'avatar-card' + (id === avatarSelecionado ? ' selecionado' : '');
    div.innerHTML = `<div class="avatar-emoji">${info.emoji}</div><div class="avatar-nome">${info.nome}</div>`;
    div.onclick = () => {
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selecionado'));
      div.classList.add('selecionado');
      avatarSelecionado = id;
    };
    grid.appendChild(div);
  });
}

$('btnEntrarSala').onclick = () => {
  if (!usuarioLogado) return;
  socket.emit('entrarSala', { usuario: usuarioLogado, avatarId: avatarSelecionado });
};

socket.on('bemVindo', (data) => {
  $('telaAvatar').classList.add('escondido');
  $('telaJogo').classList.remove('escondido');
});

// ==========================================
// LÓGICA DO JOGO
// ==========================================
socket.on('estadoJogo', (estado) => {
  const lista = $('listaJogadores');
  if (lista) {
    lista.innerHTML = '';
    [...estado.jogadores].sort((a,b) => b.pontos - a.pontos).forEach(j => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${j.avatarInfo?.emoji || '👤'}</span> <strong>${j.nome}</strong> <span style="margin-left:auto">${j.pontos} pts</span>`;
      lista.appendChild(li);
    });
  }

  if($('energiaValor')) $('energiaValor').textContent = estado.energia + '%';
  if($('energiaFill')) $('energiaFill').style.width = estado.energia + '%';

  if (estado.fase === 'lobby' || estado.fase === 'finalizado') {
    if($('areaLobby')) $('areaLobby').classList.remove('escondido');
    if($('areaDesafio')) $('areaDesafio').classList.add('escondido');
    if($('lobbyInfo')) $('lobbyInfo').innerHTML = `Jogadores: <strong>${estado.jogadores.length} / ${estado.maxJogadores}</strong>`;
    if($('btnIniciar')) $('btnIniciar').disabled = estado.jogadores.length < 2;
  } else if (estado.fase === 'jogando') {
    if($('areaLobby')) $('areaLobby').classList.add('escondido');
    if($('areaDesafio')) $('areaDesafio').classList.remove('escondido');
  }
});

if ($('btnIniciar')) $('btnIniciar').onclick = () => socket.emit('iniciarJogo');

socket.on('novaRodada', (data) => {
  if($('mensagemRodada')) $('mensagemRodada').textContent = '';
  if($('desafioPergunta')) $('desafioPergunta').textContent = data.p;
  const opcoesDiv = $('opcoesDesafio');
  if (opcoesDiv) {
    opcoesDiv.innerHTML = '';
    data.o.forEach((texto, index) => {
      const btn = document.createElement('button');
      btn.className = 'opcao';
      btn.innerHTML = `<span class="letra">${String.fromCharCode(65 + index)}</span> ${texto}`;
      btn.onclick = () => {
        document.querySelectorAll('.opcao').forEach(b => b.disabled = true);
        socket.emit('responder', { opcao: index });
      };
      opcoesDiv.appendChild(btn);
    });
  }
});

socket.on('resultadoRodada', (res) => {
  if($('mensagemRodada')) $('mensagemRodada').textContent = res.mensagem;
  const botoes = document.querySelectorAll('.opcao');
  if (botoes.length > 0 && res.respostaCorreta !== undefined) {
    botoes.forEach((b, i) => {
      b.disabled = true;
      if (i === res.respostaCorreta) b.style.borderColor = 'var(--neon-green)';
    });
  }
});

socket.on('fimDeJogo', (data) => {
  if($('modalTitulo')) $('modalTitulo').textContent = data.titulo;
  if($('modalMensagem')) $('modalMensagem').textContent = data.mensagem;
  if($('modalFim')) $('modalFim').classList.remove('escondido');
});

socket.on('erro', (msg) => {
  const toast = $('toast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.remove('escondido');
    setTimeout(() => toast.classList.add('escondido'), 3000);
  }
});

// CHAT
if ($('btnEnviarChat')) {
  $('btnEnviarChat').onclick = () => {
    const input = $('chatInput');
    if (input && input.value.trim()) {
      socket.emit('chat', { texto: input.value.trim() });
      input.value = '';
    }
  };
}

socket.on('chatMsg', (data) => {
  const chatBox = $('chatMensagens');
  if (chatBox) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-nome">${data.avatar} ${data.nome}:</span> ${data.texto}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
