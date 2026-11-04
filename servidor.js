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
const MAX_JOGADORES = 6;

const AVATARES = {
  parzival: { id: 'parzival', emoji: '🛡️', nome: 'Parzival', classe: 'Guardião', habilidade: 'Escudo de Gelo', descricao: 'Ao errar, perde metade dos pontos.' },
  art3mis: { id: 'art3mis', emoji: '⚡', nome: 'Art3mis', classe: 'Velocista', habilidade: 'Reflexo Rápido', descricao: '+5 pts ao acertar em <5s.' },
  curator: { id: 'curator', emoji: '🧠', nome: 'Curator', classe: 'Sábio', habilidade: 'Memória do OASIS', descricao: 'Vê dica extra.' },
  irok: { id: 'irok', emoji: '💥', nome: 'I-R0k', classe: 'Caótico', habilidade: 'Sabotagem', descricao: 'Rouba 3 pts do líder.' },
  og: { id: 'og', emoji: '🔮', nome: 'Og', classe: 'Oráculo', habilidade: 'Visão', descricao: 'Uma vez por partida, vê a resposta certa.' }
};

const DESAFIOS_INDIVIDUAIS = [
  { pergunta: "🧩 ENIGMA: Se 3 Gunters resolvem 3 enigmas em 3 minutos, quanto tempo 9 Gunters levam para 9 enigmas?", opcoes: ["9 minutos", "3 minutos", "27 minutos", "1 minuto"], correta: 1, tema: "Lógica", dica: "Quantos enigmas cada Gunter resolve por minuto?", pontos: 15 },
  { pergunta: "🔐 CRIPTOGRAFIA: 'OASIS' com César +3 fica:", opcoes: ["RDVLV", "OASIS", "PBUJS", "NDRHR"], correta: 0, tema: "Lógica", dica: "Avance 3 letras.", pontos: 15 },
  { pergunta: "⏱️ TEMPO: 1 hora no OASIS = 1 minuto real. 3 horas no OASIS = quantos minutos reais?", opcoes: ["3 minutos", "180 minutos", "60 minutos", "30 minutos"], correta: 0, tema: "Lógica", dica: "Multiplique por 3.", pontos: 15 },
  { pergunta: "💾 CULTURA POP: Qual NÃO é chave do filme Jogador Nº 1?", opcoes: ["Corrida Copper Key", "Enigma na Disco", "Duelo Montserrat", "Desafio Planeta Doom"], correta: 1, tema: "Cultura Pop", dica: "Uma envolve Kubrick.", pontos: 15 },
  { pergunta: "🎮 GAME DESIGN: Qual NÃO é fundamental em um jogo?", opcoes: ["Objetivo", "Regras", "Feedback", "Gráficos 4K obrigatórios"], correta: 3, tema: "Design", dica: "Pong não tinha.", pontos: 15 },
  { pergunta: "🔢 SEQUÊNCIA: 2, 3, 5, 9, 17, ...?", opcoes: ["25", "33", "31", "35"], correta: 1, tema: "Lógica", dica: "Dobro menos 1.", pontos: 15 },
  { pergunta: "🧠 ENIGMA: Leve como pena, mas nem o mais forte segura por minutos. O que é?", opcoes: ["Vento", "Respiração", "Luz", "Tempo"], correta: 1, tema: "Lógica", dica: "Você faz agora.", pontos: 15 },
  { pergunta: "💡 SEGURANÇA: Qual senha é MAIS segura?", opcoes: ["123456", "oasis2025", "Senh@F0rte!K9#", "jogador1"], correta: 2, tema: "Tecnologia", dica: "Maiúsc+minúsc+símbolos.", pontos: 15 }
];

const DESAFIOS_COOPERATIVOS = [
  { pergunta: "⚖️ O servidor está com 40%. Como economizar?", opcoes: ["Desligar entretenimento (perde 10k jogadores, salva 20%)", "Manter tudo e arriscar (0%)", "Desligar só publicidade e inativos (salva 8%)", "Imposto virtual para ricos"], correta: 2, tema: "Ética", dica: "Existe escolha sem sacrifício.", explicacao: "A solução equilibrada não prejudica ninguém." },
  { pergunta: "🌍 Encontraram o Ovo de Ouro. O que fazer?", opcoes: ["Ativar sozinho", "Vender para IOI", "Destruir", "Dividir entre todos"], correta: 3, tema: "Ética", dica: "O OASIS nunca foi sobre controle.", explicacao: "O verdadeiro tesouro é a cooperação." },
  { pergunta: "🤝 Doar 50% dos pontos para escola real?", opcoes: ["Doar tudo", "Não doar", "Doar 50% e continuar", "Doar 10%"], correta: 2, tema: "Ética", dica: "Equilíbrio entre ajudar e competir.", explicacao: "Equilíbrio entre impacto real e competição." },
  { pergunta: "🔒 Empresa oferece 1000 pts pelos dados de todos. O que fazer?", opcoes: ["Aceitar", "Recusar", "Aceitar só adultos", "Aceitar e vender"], correta: 1, tema: "Ética", dica: "Privacidade é direito.", explicacao: "Dados nunca são moeda de troca." },
  { pergunta: "🌐 OASIS é caro, só 10% pagam. Como resolver?", opcoes: ["Ignorar", "Versão gratuita limitada", "Aumentar preço dos ricos", "Fechar"], correta: 1, tema: "Ética", dica: "Acesso mínimo para todos.", explicacao: "Democratizar a tecnologia é essencial." }
];

function jogadoresArray() {
  return Object.values(estado.jogadores).map(j => ({
    id: j.id, nome: j.nome, avatar: j.avatar, avatarInfo: j.avatarInfo, pontos: j.pontos, habilidadeUsada: j.habilidadeUsada
  }));
}

function líderAtual() {
  return jogadoresArray().sort((a, b) => b.pontos - a.pontos)[0];
}

function enviarEstado() {
  io.emit('estadoJogo', {
    jogadores: jogadoresArray(),
    energia: estado.energia,
    rodada: estado.rodada,
    fase: estado.fase,
    pontosVitoria: PONTOS_VITORIA
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
        let pontosGanhos = pergunta.pontos;
        if (vencedor.avatar === 'art3mis' && vencedorResp.tempo < 5000) pontosGanhos += 5;
        let rouboInfo = null;
        if (vencedor.avatar === 'irok') {
          const lider = líderAtual();
          if (lider && lider.id !== vencedorId && lider.pontos >= 3) {
            estado.jogadores[lider.id].pontos -= 3;
            vencedor.pontos += 3;
            rouboInfo = { de: lider.nome, pontos: 3 };
          }
        }
        vencedor.pontos += pontosGanhos;
        io.emit('resultadoRodada', {
          tipo: 'individual', vencedor: vencedor.nome, avatar: vencedor.avatarInfo.emoji,
          pontosGanhos, respostaCorreta: pergunta.correta, rouboInfo, energia: estado.energia,
          jogadores: jogadoresArray(), mensagem: `🏆 ${vencedor.nome} acertou primeiro! +${pontosGanhos} pts`
        });
      }
    } else {
      io.emit('resultadoRodada', {
        tipo: 'individual', vencedor: null, respostaCorreta: pergunta.correta,
        energia: estado.energia, jogadores: jogadoresArray(),
        mensagem: `❌ Ninguém acertou. A resposta era: ${pergunta.opcoes[pergunta.correta]}`
      });
    }
    const totalErros = Object.values(respostas).filter(r => r.opcao !== pergunta.correta).length;
    if (totalErros > 0) {
      estado.energia = Math.max(0, estado.energia - totalErros * 3);
      io.emit('energiaMudou', { energia: estado.energia, delta: -totalErros * 3, motivo: `${totalErros} jogador(es) erraram` });
    }
  }

  if (tipo === 'cooperativo') {
    const contagem = {};
    Object.values(respostas).forEach(r => { contagem[r.opcao] = (contagem[r.opcao] || 0) + 1; });
    let opcaoMaisVotada = -1, maxVotos = 0;
    Object.entries(contagem).forEach(([o, v]) => { if (v > maxVotos) { maxVotos = v; opcaoMaisVotada = parseInt(o); } });
    const acertouColetivo = opcaoMaisVotada === pergunta.correta;
    const empate = Object.keys(respostas).length === 0;
    let delta = 0;
    if (empate) delta = -5;
    else if (acertouColetivo) {
      delta = +20;
      Object.entries(respostas).forEach(([jid, r]) => {
        if (r.opcao === pergunta.correta && estado.jogadores[jid]) estado.jogadores[jid].pontos += 5;
      });
    } else delta = -15;
    estado.energia = Math.max(0, Math.min(100, estado.energia + delta));
    io.emit('resultadoRodada', {
      tipo: 'cooperativo', respostaCorreta: pergunta.correta, opcaoMaisVotada, acertouColetivo, empate,
      explicacao: pergunta.explicacao, energia: estado.energia, jogadores: jogadoresArray(),
      mensagem: empate ? `⚖️ Empate! -5% energia.` : acertouColetivo ? `✅ Maioria acertou! +20% energia. +5 pts para quem votou certo.` : `❌ Maioria errou! -15% energia. Certa: ${pergunta.opcoes[pergunta.correta]}`
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
  if (estado.energia >= 100 && estado.rodada >= 6) { finalizarJogo('vitoria_coletiva', null); return true; }
  return false;
}

function finalizarJogo(tipo, vencedor) {
  estado.fase = 'finalizado';
  estado.jogoAtivo = false;
  estado.tipoFinal = tipo;
  estado.vencedor = vencedor;
  let titulo, mensagem, emoji;
  if (tipo === 'individual') {
    emoji = '🏆'; titulo = 'VITÓRIA INDIVIDUAL';
    mensagem = `${vencedor} controla o OASIS!` + (estado.energia > 50 ? ' Final positivo.' : ' Final agridoce.');
  } else if (tipo === 'vitoria_coletiva') {
    emoji = '🌟'; titulo = 'VITÓRIA COLETIVA'; mensagem = 'Todos salvaram o OASIS juntos!';
  } else {
    emoji = '💀'; titulo = 'DERROTA COLETIVA'; mensagem = 'Energia a 0%. O OASIS colapsou.';
  }
  io.emit('fimDeJogo', { tipo, titulo, mensagem, emoji, energia: estado.energia, jogadores: jogadoresArray(), vencedor });
  if (timeoutRodada) clearTimeout(timeoutRodada);
}

function resetarEstado() {
  if (timeoutRodada) clearTimeout(timeoutRodada);
  estado.jogoAtivo = false;
  estado.energia = 100;
  estado.rodada = 0;
  estado.rodadaAtual = null;
  estado.fase = 'lobby';
  estado.vencedor = null;
  estado.tipoFinal = null;
  Object.values(estado.jogadores).forEach(j => { j.pontos = 0; j.habilidadeUsada = false; });
  filaIndividual = [];
  filaCoop = [];
}

io.on('connection', (socket) => {
  socket.on('entrar', ({ nome, avatarId }) => {
    if (Object.keys(estado.jogadores).length >= MAX_JOGADORES) return socket.emit('erro', 'Sala cheia.');
    if (estado.fase === 'jogando') return socket.emit('erro', 'Partida em andamento.');
    const avatarInfo = AVATARES[avatarId] || AVATARES.parzival;
    estado.jogadores[socket.id] = {
      id: socket.id, nome: (nome || 'Anônimo').substring(0, 18),
      avatar: avatarInfo.id, avatarInfo, pontos: 0, habilidadeUsada: false
    };
    socket.emit('bemVindo', { id: socket.id, avatares: AVATARES });
    enviarEstado();
  });

  socket.on('iniciarJogo', () => {
    if (Object.keys(estado.jogadores).length < MIN_JOGADORES) return socket.emit('erro', `Mínimo ${MIN_JOGADORES} jogadores.`);
    if (estado.fase === 'jogando') return;
    resetarEstado();
    estado.fase = 'jogando';
    estado.jogoAtivo = true;
    estado.rodada = 0;
    io.emit('jogoIniciado');
    setTimeout(() => proximaRodada(), 1500);
  });

  socket.on('responder', ({ opcao, tempoMs }) => {
    if (estado.fase !== 'jogando' || !estado.rodadaAtual) return;
    if (estado.rodadaAtual.respostas[socket.id]) return;
    if (!estado.jogadores[socket.id]) return;
    estado.rodadaAtual.respostas[socket.id] = { opcao: parseInt(opcao), tempo: tempoMs || (Date.now() - estado.rodadaAtual.inicioEm) };
    socket.emit('respostaRegistrada');
    if (estado.rodadaAtual.tipo === 'individual') {
      const correta = estado.rodadaAtual.pergunta.correta;
      const todos = Object.keys(estado.rodadaAtual.respostas).length === Object.keys(estado.jogadores).length;
      const alguemAcertou = Object.values(estado.rodadaAtual.respostas).some(r => r.opcao === correta);
      if (alguemAcertou || todos) {
        if (timeoutRodada) clearTimeout(timeoutRodada);
        setTimeout(() => encerrarRodada(), 300);
      }
    }
    if (estado.rodadaAtual.tipo === 'cooperativo') {
      if (Object.keys(estado.rodadaAtual.respostas).length === Object.keys(estado.jogadores).length) {
        if (timeoutRodada) clearTimeout(timeoutRodada);
        setTimeout(() => encerrarRodada(), 500);
      }
    }
    enviarEstado();
  });

  socket.on('usarHabilidadeOg', () => {
    const j = estado.jogadores[socket.id];
    if (!j || j.avatar !== 'og' || j.habilidadeUsada) return;
    if (!estado.rodadaAtual || estado.rodadaAtual.tipo !== 'individual') return;
    j.habilidadeUsada = true;
    socket.emit('revelarResposta', { correta: estado.rodadaAtual.pergunta.correta });
    io.emit('ogUsouHabilidade', { nome: j.nome });
  });

  socket.on('pedirDica', () => {
    const j = estado.jogadores[socket.id];
    if (j && j.avatar === 'curator' && estado.rodadaAtual) socket.emit('dica', { dica: estado.rodadaAtual.pergunta.dica });
  });

  socket.on('chat', ({ texto }) => {
    const j = estado.jogadores[socket.id];
    if (!j) return;
    io.emit('chatMsg', { nome: j.nome, avatar: j.avatarInfo.emoji, texto: (texto || '').substring(0, 200) });
  });

  socket.on('reiniciar', () => {
    resetarEstado();
    io.emit('jogoReiniciado');
    enviarEstado();
  });

  socket.on('disconnect', () => {
    delete estado.jogadores[socket.id];
    if (Object.keys(estado.jogadores).length === 0) resetarEstado();
    else if (estado.fase === 'jogando' && estado.rodadaAtual) delete estado.rodadaAtual.respostas[socket.id];
    enviarEstado();
  });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, '0.0.0.0', () => {
  console.log(`\n🌌 OASIS rodando na porta ${PORTA}\n`);
});
