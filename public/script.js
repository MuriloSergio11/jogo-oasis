const socket = io();
let usuarioLogado = null;
let avatarSelecionado = 'parzival';

const AVATARES = {
  parzival: { emoji: '🛡️', nome: 'Parzival' }, 
  art3mis: { emoji: '⚡', nome: 'Art3mis' },
  curator: { emoji: '🧠', nome: 'Curator' }, 
  irok: { emoji: '💥', nome: 'I-R0k' }, 
  og: { emoji: '🔮', nome: 'Og' }
};

const $ = (id) => document.getElementById(id);

// ==========================================
// 1. TELA DE LOGIN E CADASTRO
// ==========================================
$('btnLogin').onclick = () => {
  const u = $('inputUsuario').value.trim();
  const s = $('inputSenha').value.trim();
  if (!u || !s) return mostrarAvisoLogin('Preencha usuário e senha.');
  socket.emit('login', { usuario: u, senha: s });
};

$('btnCadastrar').onclick = () => {
  const u = $('inputUsuario').value.trim();
  const s = $('inputSenha').value.trim();
  if (!u || !s) return mostrarAvisoLogin('Preencha usuário e senha.');
  socket.emit('cadastrar', { usuario: u, senha: s });
};

function mostrarAvisoLogin(msg) {
  const aviso = $('avisoLogin');
  aviso.textContent = '⚠️ ' + msg;
  aviso.classList.remove('escondido');
  setTimeout(() => aviso.classList.add('escondido'), 3000);
}

// Login com Sucesso vindo do servidor
socket.on('loginSucesso', (data) => {
  usuarioLogado = data.usuario;
  avatarSelecionado = data.avatar || 'parzival';
  
  $('boasVindasNome').innerHTML = `Bem-vindo, <strong>${usuarioLogado}</strong>!`;
  $('telaLogin').classList.add('escondido');
  $('telaAvatar').classList.remove('escondido');
  
  montarAvatares();
});

socket.on('erroLogin', (msg) => {
  mostrarAvisoLogin(msg);
});

// ==========================================
// 2. TELA DE ESCOLHA DE AVATAR
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

// Entrou na Sala com Sucesso
socket.on('bemVindo', (data) => {
  $('telaAvatar').classList.add('escondido');
  $('telaJogo').classList.remove('escondido');
});

// ==========================================
// 3. LÓGICA DO JOGO (O resto que já funcionava)
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

// Chat
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
