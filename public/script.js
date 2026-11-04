// 1. Verifica se a internet carregou o Socket.IO
if (typeof io === 'undefined') {
  document.body.innerHTML = '<h1 style="color:white; text-align:center; margin-top:20%; font-family:sans-serif;">Erro de Conexão.<br>Recarregue a página.</h1>';
  throw new Error('Socket.IO falhou');
}

const socket = io();
let meuId = null;
let jaRespondi = false;
let avatarSelecionado = 'parzival';

const AVATARES = {
  parzival: { emoji: '🛡️', nome: 'Parzival' }, 
  art3mis: { emoji: '⚡', nome: 'Art3mis' },
  curator: { emoji: '🧠', nome: 'Curator' }, 
  irok: { emoji: '💥', nome: 'I-R0k' }, 
  og: { emoji: '🔮', nome: 'Og' }
};

// 2. Função segura para pegar elementos
function el(id) { return document.getElementById(id); }

// 3. Monta a tela de entrada (Só roda se achar a div)
const grid = el('gridAvatares');
if (grid) {
  grid.innerHTML = '';
  Object.entries(AVATARES).forEach(([id, info]) => {
    const div = document.createElement('div');
    div.className = `avatar-card ${id === avatarSelecionado ? 'selecionado' : ''}`;
    div.innerHTML = `<div class="avatar-emoji">${info.emoji}</div><div class="avatar-nome">${info.nome}</div>`;
    div.onclick = () => {
      document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selecionado'));
      div.classList.add('selecionado');
      avatarSelecionado = id;
    };
    grid.appendChild(div);
  });
}

// 4. Botão de Entrar
const btnEntrar = el('btnEntrar');
if (btnEntrar) {
  btnEntrar.onclick = () => {
    const nome = el('inputNome').value.trim();
    if (!nome) return alert('Digite um nome!');
    socket.emit('entrar', { nome, avatarId: avatarSelecionado });
  };
}

// 5. Recebe o sinal verde do servidor e troca a tela
socket.on('bemVindo', (data) => {
  meuId = data.id;
  if(el('telaEntrada')) el('telaEntrada').classList.add('escondido');
  if(el('telaJogo')) el('telaJogo').classList.remove('escondido');
});

// 6. Atualiza o Placar e a Energia na tela
socket.on('estadoJogo', (estado) => {
  const lista = el('listaJogadores');
  if (lista) {
    lista.innerHTML = '';
    [...estado.jogadores].sort((a,b) => b.pontos - a.pontos).forEach(j => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${j.avatarInfo?.emoji || '👤'}</span> <strong>${j.nome}</strong> <span style="margin-left:auto">${j.pontos} pts</span>`;
      lista.appendChild(li);
    });
  }

  if(el('energiaValor')) el('energiaValor').textContent = estado.energia + '%';
  if(el('energiaFill')) el('energiaFill').style.width = estado.energia + '%';

  // Troca a tela do centro (Lobby x Pergunta)
  if (estado.fase === 'lobby' || estado.fase === 'finalizado') {
    if(el('areaLobby')) el('areaLobby').classList.remove('escondido');
    if(el('areaDesafio')) el('areaDesafio').classList.add('escondido');
    if(el('lobbyInfo')) el('lobbyInfo').innerHTML = `Jogadores: <strong>${estado.jogadores.length} / 5</strong>`;
    if(el('btnIniciar')) el('btnIniciar').disabled = estado.jogadores.length < 2;
  } else if (estado.fase === 'jogando') {
    if(el('areaLobby')) el('areaLobby').classList.add('escondido');
    if(el('areaDesafio')) el('areaDesafio').classList.remove('escondido');
  }
});

// 7. Botão Iniciar Jogo
const btnIniciar = el('btnIniciar');
if (btnIniciar) btnIniciar.onclick = () => socket.emit('iniciarJogo');

// 8. Mostra as Perguntas
socket.on('novaRodada', (data) => {
  jaRespondi = false;
  if(el('mensagemRodada')) el('mensagemRodada').textContent = '';
  if(el('desafioPergunta')) el('desafioPergunta').textContent = data.pergunta;
  
  const opcoesDiv = el('opcoesDesafio');
  if (opcoesDiv) {
    opcoesDiv.innerHTML = '';
    data.opcoes.forEach((texto, index) => {
      const btn = document.createElement('button');
      btn.className = 'opcao';
      btn.innerHTML = `<span class="letra">${String.fromCharCode(65 + index)}</span> ${texto}`;
      btn.onclick = () => {
        if (jaRespondi) return;
        jaRespondi = true;
        document.querySelectorAll('.opcao').forEach(b => b.disabled = true);
        socket.emit('responder', { opcao: index, tempoMs: 1000 });
      };
      opcoesDiv.appendChild(btn);
    });
  }
});

// 9. Mostra o Resultado (Certo ou Errado)
socket.on('resultadoRodada', (res) => {
  if(el('mensagemRodada')) el('mensagemRodada').textContent = res.mensagem;
  const botoes = document.querySelectorAll('.opcao');
  if (botoes.length > 0 && res.respostaCorreta !== undefined) {
    botoes.forEach((b, i) => {
      b.disabled = true;
      if (i === res.respostaCorreta) b.style.borderColor = 'var(--neon-green)';
    });
  }
});

// 10. Fim de Jogo
socket.on('fimDeJogo', (data) => {
  if(el('modalTitulo')) el('modalTitulo').textContent = data.titulo;
  if(el('modalMensagem')) el('modalMensagem').textContent = data.mensagem;
  if(el('modalFim')) el('modalFim').classList.remove('escondido');
});

// 11. Avisos de Erro
socket.on('erro', (msg) => {
  const toast = el('toast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.remove('escondido');
    setTimeout(() => toast.classList.add('escondido'), 3000);
  }
});

// 12. Chat
const btnEnviarChat = el('btnEnviarChat');
if (btnEnviarChat) {
  btnEnviarChat.onclick = () => {
    const input = el('chatInput');
    if (input && input.value.trim()) {
      socket.emit('chat', { texto: input.value.trim() });
      input.value = '';
    }
  };
}

socket.on('chatMsg', (data) => {
  const chatBox = el('chatMensagens');
  if (chatBox) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-nome">${data.avatar} ${data.nome}:</span> ${data.texto}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
