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
  vencedor: null
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
  { pergunta: "🧩 ENIGMA: Se 3 Gunters resolvem 3 enigmas em 3 minutos, quanto tempo 9 Gunters levam para 9 enigmas?", opcoes: ["9 minutos", "3 minutos", "27 minutos", "1 minuto"], correta: 1, tema: "Lógica", pontos: 15 },
  { pergunta: "🔐 CRIPTOGRAFIA: A palavra 'OASIS' com Cifra de César (+3) fica:", opcoes: ["RDVLV", "OASIS", "PBUJS", "NDRHR"], correta: 0, tema: "Lógica", pontos: 15 },
  { pergunta: "⏱️ TEMPO: No OASIS, 1 hora equivale a 1 minuto real. Se você ficar 3 horas, quantos minutos reais se passaram?", opcoes: ["3 minutos", "180 minutos", "60 minutos", "30 minutos"], correta: 0, tema: "Lógica", pontos: 15 },
  { pergunta: "💾 CULTURA POP: Qual NÃO é uma das chaves no filme Jogador Nº 1?", opcoes: ["Corrida Copper Key", "Enigma na Disco", "Duelo Montserrat", "Desafio Planeta Doom"], correta: 1, tema: "Cultura Pop", pontos: 15 },
  { pergunta: "🎮 GAME DESIGN: Qual NÃO é fundamental em um jogo digital?", opcoes: ["Objetivo claro", "Regras definidas", "Feedback ao jogador", "Gráficos 4K obrigatórios"], correta: 3, tema: "Design", pontos: 15 },
  { pergunta: "🔢 SEQUÊNCIA: Qual o próximo número da sequência 2, 3, 5, 9, 17, ...?", opcoes: ["25", "33", "31", "35"], correta: 1, tema: "Lógica", pontos: 15 }
];

const DESAFIOS_COOPERATIVOS = [
  { pergunta: "⚖️ DILEMA DO OASIS: O servidor está com 40% de energia. Como vocês vão economizar?", opcoes: ["Desligar entretenimento (perde 10k jogadores, salva 20%)", "Manter tudo ligado e arriscar colapso (0%)", "Desligar apenas publicidade e servidores inativos (salva 8%)", "Criar um imposto virtual para os jogadores ricos"], correta: 2, tema: "Ética", explicacao: "A solução equilibrada não prejudica ninguém e ainda economiza energia." },
  { pergunta: "🌍 REALIDADE VS VIRTUAL: Vocês encontraram o Ovo de Ouro. O que fazer com ele?", opcoes: ["Ativar sozinho e controlar o OASIS", "Vender o Ovo para uma megacorporação (IOI)", "Destruir o Ovo para ninguém controlar", "Dividir o controle entre todos os jogadores"], correta: 3, tema: "Ética", explicacao: "O verdadeiro tesouro é a cooperação." }
];

function jogadoresArray() {
  return Object.values(estado.jogadores).map(j => ({
    id: j.id, nome: j.nome, avatar: j.avatar, avatarInfo: j.avatarInfo, pontos: j.pontos
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let filaIndividual = [];
let filaCoop = [];
let timeoutRodada = null;

function proximaRodada() {
  if (estado.fase !== 'jogando') return;
  if (timeoutRodada) clearTimeout(timeoutRodada);
  estado.rodada++;
  if (verificarFim()) return;

  const ehCoop = estado.rodada % 3 === 0;

  if (ehCoop) {
    if (filaCoop.length === 0) filaCoop = shuffle(DESAFIOS_COOPERATIVOS);
    const pergunta = filaCoop.pop();
    estado.rodadaAtual = { tipo: 'cooperativo', pergunta, respostas: {}, inicioEm: Date.now(), duracao: 25000 };
    io.emit('novaRodada', { tipo: 'cooperativo', rodada: estado.rodada, pergunta: pergunta.pergunta, opcoes: pergunta.opcoes, tema: pergunta.tema, duracao: 25 });
  } else {
    if (filaIndividual.length === 0) filaIndividual = shuffle(DESAFIOS_INDIVIDUAIS);
    const pergunta = filaIndividual.pop();
    estado.rodadaAtual = { tipo: 'individual', pergunta, respostas: {}, inicioEm: Date.now(), duracao: 20000 };
    io.emit('novaRodada', { tipo: 'individual', rodada: estado.rodada, pergunta: pergunta.pergunta, opcoes: pergunta.opcoes, tema: pergunta.tema, duracao: 20 });
  }
  enviarEstado();
  timeoutRodada = setTimeout(() => encerrarRodada(), estado.rodadaAtual.duracao);
}

function encerrarRodada() {
  if (!estado.rodadaAtual) return;
  const { tipo, pergunta, respostas } = estado.rodadaAtual;

  if (tipo === 'individual') {
    const acertos = Object.entries(respostas).filter(([_, r]) => r.opcao === pergunta.correta);
    if (acertos.length > 0) {
      acertos.sort((a, b) => a[1].tempo - b[1].tempo);
      const [vencedorId, vencedorResp] = acertos[0];
      const vencedor = estado.jogadores[vencedorId];
      if (vencedor) {
        vencedor.pontos += pergunta.pontos;
        io.emit('resultadoRodada', {
          tipo: 'individual', vencedor: vencedor.nome, avatar: vencedor.avatarInfo.emoji,
          pontosGanhos: pergunta.pontos, respostaCorreta: pergunta.correta, energia: estado.energia,
          jogadores: jogadoresArray(), mensagem: `🏆 ${vencedor.nome} acertou primeiro! +${pergunta.pontos} pts`
        });
      }
    } else {
      io.emit('resultadoRodada', {
        tipo: 'individual', vencedor: null, respostaCorreta: pergunta.correta,
        energia: estado.energia, jogadores: jogadoresArray(),
        mensagem: `❌ Ninguém acertou. A resposta era: ${pergunta.opcoes[pergunta.correta]}`
      });
    }
  } else if (tipo === 'cooperativo') {
    io.emit('resultadoRodada', {
      tipo: 'cooperativo', respostaCorreta: pergunta.correta, explicacao: pergunta.explicacao,
      energia: estado.energia, jogadores: jogadoresArray(), mensagem: `A resposta correta era: ${pergunta.opcoes[pergunta.correta]}`
    });
  }

  estado.rodadaAtual = null;
  enviarEstado();
  if (verificarFim()) return;
  timeoutRodada = setTimeout(() => proximaRodada(), 5000);
}

function verificarFim() {
  const v = jogadoresArray().find(j => j.pontos >= PONTOS_VITORIA);
  if (v) { finalizarJogo('individual', v.nome); return true; }
  if (estado.energia <= 0) { finalizarJogo('derrota_coletiva', null); return true; }
  return false;
}

function finalizarJogo(tipo, vencedor) {
  estado.fase = 'finalizado';
  estado.jogoAtivo = false;
  let titulo = tipo === 'individual' ? 'VITÓRIA INDIVIDUAL' : 'DERROTA COLETIVA';
  let mensagem = tipo === 'individual' ? `${vencedor} controla o OASIS!` : 'Energia a 0%. O OASIS colapsou.';
  io.emit('fimDeJogo', { titulo, mensagem, emoji: tipo === 'individual' ? '🏆' : '💀', jogadores: jogadoresArray() });
  if (timeoutRodada) clearTimeout(timeoutRodada);
}

io.on('connection', (socket) => {
  socket.on('entrar', ({ nome, avatarId }) => {
    if (Object.keys(estado.jogadores).length >= MAX_JOGADORES) return socket.emit('erro', 'A sala está cheia.');
    if (estado.fase === 'jogando') return socket.emit('erro', 'Partida em andamento.');
    
    Object.keys(estado.jogadores).forEach(id => {
      if (estado.jogadores[id].nome.toLowerCase() === nome.toLowerCase()) delete estado.jogadores[id];
    });

    const avatarInfo = AVATARES[avatarId] || AVATARES.parzival;
    estado.jogadores[socket.id] = {
      id: socket.id, nome: (nome || 'Anônimo').substring(0, 18),
      avatar: avatarInfo.id, avatarInfo, pontos: 0
    };
    socket.emit('bemVindo', { id: socket.id });
    enviarEstado();
  });

  socket.on('iniciarJogo', () => {
    if (Object.keys(estado.jogadores).length < MIN_JOGADORES) return socket.emit('erro', `Precisa de pelo menos ${MIN_JOGADORES} jogadores.`);
    estado.fase = 'jogando';
    estado.jogoAtivo = true;
    estado.rodada = 0;
    estado.energia = 100;
    Object.values(estado.jogadores).forEach(j => { j.pontos = 0; });
    io.emit('jogoIniciado');
    setTimeout(() => proximaRodada(), 1500);
  });

  socket.on('responder', ({ opcao, tempoMs }) => {
    if (estado.fase !== 'jogando' || !estado.rodadaAtual) return;
    if (estado.rodadaAtual.respostas[socket.id]) return;
    estado.rodadaAtual.respostas[socket.id] = { opcao: parseInt(opcao), tempo: tempoMs };
    
    if (estado.rodadaAtual.tipo === 'individual') {
      const correta = estado.rodadaAtual.pergunta.correta;
      const alguemAcertou = Object.values(estado.rodadaAtual.respostas).some(r => r.opcao === correta);
      if (alguemAcertou) { if (timeoutRodada) clearTimeout(timeoutRodada); setTimeout(() => encerrarRodada(), 300); }
    }
  });

  socket.on('reiniciar', () => {
    estado.fase = 'lobby';
    estado.energia = 100;
    estado.rodada = 0;
    estado.rodadaAtual = null;
    Object.values(estado.jogadores).forEach(j => { j.pontos = 0; });
    io.emit('jogoReiniciado');
    enviarEstado();
  });

  socket.on('chat', ({ texto }) => {
    const j = estado.jogadores[socket.id];
    if (j) io.emit('chatMsg', { nome: j.nome, avatar: j.avatarInfo.emoji, texto: texto.substring(0, 200) });
  });

  socket.on('disconnect', () => {
    delete estado.jogadores[socket.id];
    enviarEstado();
  });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, '0.0.0.0', () => console.log(`Servidor OASIS rodando na porta ${PORTA}`));
