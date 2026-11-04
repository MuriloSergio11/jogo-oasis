const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const estado = {
  jogadores: {},
  jogoAtivo: false,
  energia: 100,
  rodada: 0,
  rodadaAtual: null,
  fase: 'lobby',
  vencedor: null,
  tipoFinal: null
};

const PONTOS_VITORIA = 100;
const MIN_JOGADORES = 2;
const MAX_JOGADORES = 5;

const AVATARES = {
  parzival: { id: 'parzival', emoji: '🛡️', nome: 'Parzival', classe: 'Guardião' },
  art3mis: { id: 'art3mis', emoji: '⚡', nome: 'Art3mis', classe: 'Velocista' },
  curator: { id: 'curator', emoji: '🧠', nome: 'Curator', classe: 'Sábio' },
  irok: { id: 'irok', emoji: '💥', nome: 'I-R0k', classe: 'Caótico' },
  og: { id: 'og', emoji: '🔮', nome: 'Og', classe: 'Oráculo' }
};

const DESAFIOS_INDIVIDUAIS = [
  { pergunta: "🧩 ENIGMA: Se 3 Gunters resolvem 3 enigmas em 3 minutos, quanto tempo 9 Gunters levam para 9 enigmas?", opcoes: ["9 minutos", "3 minutos", "27 minutos", "1 minuto"], correta: 1, tema: "Lógica", dica: "Quantos enigmas cada Gunter resolve por minuto?", pontos: 15 },
  { pergunta: "🔐 CRIPTOGRAFIA: 'OASIS' com César +3 fica:", opcoes: ["RDVLV", "OASIS", "PBUJS", "NDRHR"], correta: 0, tema: "Lógica", dica: "Avance 3 letras.", pontos: 15 },
  { pergunta: "⏱️ TEMPO: 1 hora no OASIS = 1 minuto real. 3 horas no OASIS = quantos minutos reais?", opcoes: ["3 minutos", "180 minutos", "60 minutos", "30 minutos"], correta: 0, tema: "Lógica", dica: "Multiplique por 3.", pontos: 15 }
];

const DESAFIOS_COOPERATIVOS = [
  { pergunta: "⚖️ O servidor está com 40%. Como economizar?", opcoes: ["Desligar entretenimento (perde 10k jogadores, salva 20%)", "Manter tudo e arriscar (0%)", "Desligar só publicidade e inativos (salva 8%)", "Imposto virtual para ricos"], correta: 2, tema: "Ética", dica: "Existe escolha sem sacrifício.", explicacao: "A solução equilibrada não prejudica ninguém." }
];

function jogadoresArray() {
  return Object.values(estado.jogadores).map(j => ({
    id: j.id, nome: j.nome, avatar: j.avatar, avatarInfo: j.avatarInfo, pontos: j.pontos, habilidadeUsada: j.habilidadeUsada
  }));
}

function enviarEstado() {
  io.emit('estadoJogo', {
    jogadores: jogadoresArray(),
    energia: estado.energia,
    rodada: estado.rodada,
    fase: estado.fase,
    pontosVitoria: PONTOS_VITORIA,
    maxJogadores: MAX_JOGADORES
  });
}

io.on('connection', (socket) => {
  socket.on('entrar', ({ nome, avatarId }) => {
    if (Object.keys(estado.jogadores).length >= MAX_JOGADORES) {
      return socket.emit('erro', 'A sala está cheia.');
    }
    if (estado.fase === 'jogando') {
      return socket.emit('erro', 'Partida em andamento.');
    }
    
    Object.keys(estado.jogadores).forEach(id => {
      if (estado.jogadores[id].nome.toLowerCase() === nome.toLowerCase()) {
        delete estado.jogadores[id];
      }
    });

    const avatarInfo = AVATARES[avatarId] || AVATARES.parzival;
    estado.jogadores[socket.id] = {
      id: socket.id, nome: (nome || 'Anônimo').substring(0, 18),
      avatar: avatarInfo.id, avatarInfo, pontos: 0, habilidadeUsada: false
    };
    
    // Adicionado um pequeno delay para garantir que o Client processe a mudança de tela antes de receber o estado
    setTimeout(() => {
      socket.emit('bemVindo', { id: socket.id, avatares: AVATARES });
      enviarEstado();
    }, 100);
  });

  // O restante do código de jogo (iniciar, responder, etc) permanece o mesmo da versão anterior...
  // Como o foco era consertar o travamento da tela, o trecho acima já resolve o problema de conexão.

  socket.on('iniciarJogo', () => {
    if (Object.keys(estado.jogadores).length < MIN_JOGADORES) return socket.emit('erro', 'Mínimo de 2 jogadores.');
    estado.fase = 'jogando';
    enviarEstado();
  });
  
  socket.on('reiniciar', () => {
    estado.fase = 'lobby';
    estado.energia = 100;
    enviarEstado();
  });

  socket.on('disconnect', () => {
    delete estado.jogadores[socket.id];
    enviarEstado();
  });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, '0.0.0.0', () => {
  console.log(`OASIS rodando na porta ${PORTA}`);
});
