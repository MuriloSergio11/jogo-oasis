const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const estado = {
  jogadores: {},
  fase: 'lobby',
  energia: 100,
  rodada: 0,
  perguntaAtual: null
};

const MAX_JOGADORES = 5;
const MIN_JOGADORES = 2;

const AVATARES = {
  parzival: { emoji: '🛡️', nome: 'Parzival' }, 
  art3mis: { emoji: '⚡', nome: 'Art3mis' },
  curator: { emoji: '🧠', nome: 'Curator' }, 
  irok: { emoji: '💥', nome: 'I-R0k' }, 
  og: { emoji: '🔮', nome: 'Og' }
};

const PERGUNTAS = [
  { p: "🧩 ENIGMA: Se 3 Gunters resolvem 3 enigmas em 3 minutos, quanto tempo 9 Gunters levam para 9 enigmas?", o: ["9 minutos", "3 minutos", "27 minutos", "1 minuto"], c: 1 },
  { p: "🔐 CRIPTOGRAFIA: A palavra 'OASIS' com Cifra de César (+3) fica:", o: ["RDVLV", "OASIS", "PBUJS", "NDRHR"], c: 0 },
  { p: "💾 CULTURA POP: Qual NÃO é uma das chaves no filme Jogador Nº 1?", o: ["Corrida Copper Key", "Enigma na Disco", "Duelo Montserrat", "Desafio Planeta Doom"], c: 1 }
];

function enviarEstado() {
  io.emit('estadoJogo', {
    jogadores: Object.values(estado.jogadores),
    fase: estado.fase,
    energia: estado.energia,
    rodada: estado.rodada,
    maxJogadores: MAX_JOGADORES
  });
}

function iniciarRodada() {
  if (estado.fase !== 'jogando') return;
  estado.rodada++;
  
  if (estado.rodada > 5) {
    finalizar('VITÓRIA COLETIVA', 'Vocês sobreviveram ao OASIS!');
    return;
  }

  estado.perguntaAtual = PERGUNTAS[Math.floor(Math.random() * PERGUNTAS.length)];
  io.emit('novaRodada', estado.perguntaAtual);
  enviarEstado();

  setTimeout(() => {
    if (estado.fase === 'jogando' && estado.perguntaAtual) {
      io.emit('resultadoRodada', { 
        vencedor: null, 
        respostaCorreta: estado.perguntaAtual.c, 
        mensagem: "Tempo esgotado! Ninguém acertou." 
      });
      estado.energia = Math.max(0, estado.energia - 10);
      estado.perguntaAtual = null;
      enviarEstado();
      setTimeout(iniciarRodada, 4000);
    }
  }, 15000);
}

function finalizar(titulo, mensagem) {
  estado.fase = 'finalizado';
  estado.perguntaAtual = null;
  io.emit('fimDeJogo', { titulo, mensagem });
  enviarEstado();
}

io.on('connection', (socket) => {
  console.log('Jogador conectado:', socket.id);

  socket.on('entrar', ({ nome, avatarId }) => {
    if (Object.keys(estado.jogadores).length >= MAX_JOGADORES) {
      return socket.emit('erro', 'A sala está cheia.');
    }
    if (estado.fase === 'jogando') {
      return socket.emit('erro', 'Partida em andamento.');
    }

    estado.jogadores[socket.id] = {
      id: socket.id,
      nome: nome,
      avatarInfo: AVATARES[avatarId] || AVATARES.parzival,
      pontos: 0
    };

    // A CORREÇÃO FATAL AQUI: Envia o ID de volta para o navegador destravar a tela
    socket.emit('bemVindo', { id: socket.id });
    
    // Atualiza a lista de jogadores para todos
    enviarEstado();
  });

  socket.on('iniciarJogo', () => {
    if (Object.keys(estado.jogadores).length < MIN_JOGADORES) {
      return socket.emit('erro', 'Precisa de pelo menos 2 jogadores.');
    }
    if (estado.fase === 'jogando') return;

    estado.fase = 'jogando';
    estado.energia = 100;
    estado.rodada = 0;
    Object.values(estado.jogadores).forEach(j => j.pontos = 0);

    enviarEstado();
    setTimeout(iniciarRodada, 1000);
  });

  socket.on('responder', ({ opcao }) => {
    if (estado.fase !== 'jogando' || !estado.perguntaAtual) return;
    const jogador = estado.jogadores[socket.id];
    
    if (opcao === estado.perguntaAtual.c) {
      jogador.pontos += 15;
      io.emit('resultadoRodada', {
        vencedor: jogador.nome,
        respostaCorreta: estado.perguntaAtual.c,
        mensagem: `🏆 ${jogador.nome} acertou primeiro! +15 pts`
      });
      estado.perguntaAtual = null;
      enviarEstado();
      setTimeout(iniciarRodada, 4000);
    } else {
      estado.energia = Math.max(0, estado.energia - 5);
      socket.emit('erro', 'Resposta errada! -5% energia.');
      enviarEstado();
    }
  });

  socket.on('chat', ({ texto }) => {
    const j = estado.jogadores[socket.id];
    if (j) io.emit('chatMsg', { nome: j.nome, avatar: j.avatarInfo.emoji, texto: texto.substring(0, 100) });
  });

  socket.on('disconnect', () => {
    delete estado.jogadores[socket.id];
    enviarEstado();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
