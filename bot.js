const venom = require('venom-bot');
const schedule = require('node-schedule');
const fs = require('fs');

let cotizadores = Array(3).fill().map(() => ({ ocupado: false, usuarioId: null }));
let turnos = {
  lunes: ['', '', '', '', ''],
  martes: ['', '', '', '', ''],
  miercoles: ['', '', '', '', ''],
  jueves: ['', '', '', '', ''],
  viernes: ['', '', '', '', ''],
  sabado: ['', '', '', '', '']
};

const saveData = () => {
  const dataToSave = { cotizadores, turnos };
  console.log('Datos a guardar:', JSON.stringify(dataToSave, null, 2));
  fs.writeFileSync('data.json', JSON.stringify(dataToSave, null, 2));
  console.log('Datos guardados exitosamente.');
};

const loadData = () => {
  try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    console.log('Datos cargados:', JSON.stringify(data, null, 2));
    ({ cotizadores, turnos } = data);
    console.log('Estructura de turnos después de cargar:', JSON.stringify(turnos, null, 2));
    console.log('Datos cargados exitosamente.');
  } catch (error) {
    console.log('Error al cargar datos:', error.message);
    console.log('No se pudo cargar el archivo de datos. Se usarán los valores por defecto.');
  }
};

venom.create({
  session: 'cotizador-turnos-bot',
  multidevice: true,
  logQR: true,
  useChrome: false,
  browserArgs: ['--no-sandbox'],
  qrTimeout: 60000,
})
.then(start)
.catch((error) => console.error('Error al crear el cliente:', error));

function start(client) {
  console.log('Bot iniciado correctamente!');
  loadData();
  schedule.scheduleJob('30 17 * * 6', () => liberarTurnos(client));

  client.onMessage((message) => {
    const command = normalizeText(message.body.toLowerCase().trim());
    const handlers = {
      '@comandos': () => mostrarComandos(client, message.from),
      '@cotizador': () => mostrarEstadoCotizadores(client, message.from),
      '@cotizadoron': () => asignarCotizador(client, message.from),
      '@cotizadoroff': () => liberarCotizador(client, message.from),
      '@turnos': () => mostrarTurnos(client, message.from),
      '@tomar': () => tomarTurno(client, message),
      '@liberarturno': () => liberarTurnoEspecifico(client, message),
      '@liberarcotizador': () => liberarTodosCotizadores(client, message.from),
      '@liberarhorario': () => liberarHorarioManual(client, message.from)
    };

    const handler = handlers[command.split(' ')[0]];
    if (handler) handler();
  });
}

function mostrarComandos(client, from) {
  const comandos = [
    "@comandos - Muestra esta lista de comandos",
    "@cotizador - Muestra el estado de los cotizadores",
    "@cotizadoron - Asigna un cotizador",
    "@cotizadoroff - Libera un cotizador",
    "@liberarcotizador - Libera todos los cotizadores",
    "@turnos - Muestra los turnos disponibles",
    "@tomar [nombre] [día1] [día2] [día3] - Toma turnos",
    "@liberarturno [nombre] [día] - Libera un turno específico",
    "@liberarhorario - Libera todos los turnos manualmente"
  ];

  const mensaje = "📋 Comandos disponibles:\n\n" + comandos.join("\n");
  client.sendText(from, mensaje);
}

function mostrarEstadoCotizadores(client, from) {
  const status = cotizadores.map((slot, index) => 
    `Cotizador ${index + 1}: ${slot.ocupado ? '🔴 Ocupado' : '🟢 Disponible'}`
  ).join('\n');
  const infoMessage = `*Cotizadores de Isapre - Mejora Tu Salud* 🏥💻\n\n${status}\n\n` +
    `*Cotizador 1*: freyes.mora@gmail.com / felipereyes\n` +
    `*Cotizador 2*: naranjo.paula.ps@gmail.com / paulanaranjo\n` +
    `*Cotizador 3*: nalladettmorajara@gmail.com / felipe\n\n` +
    `Usa @cotizadoron para ocupar un cotizador y @cotizadoroff para liberarlo.`;
  
  client.sendText(from, infoMessage);
}

function asignarCotizador(client, from) {
  const slotDisponible = cotizadores.findIndex(slot => !slot.ocupado);
  if (slotDisponible !== -1) {
    cotizadores[slotDisponible] = { ocupado: true, usuarioId: from };
    client.sendText(from, `✅ Cotizador ${slotDisponible + 1} asignado. ¡Buena suerte! 🍀`);
    saveData();
  } else {
    client.sendText(from, '❌ Lo siento, todos los cotizadores están ocupados en este momento. 😔');
  }
}

function liberarCotizador(client, from) {
  const slotOcupado = cotizadores.findIndex(slot => slot.ocupado && slot.usuarioId === from);
  if (slotOcupado !== -1) {
    cotizadores[slotOcupado] = { ocupado: false, usuarioId: null };
    client.sendText(from, `✅ Cotizador ${slotOcupado + 1} liberado. ¡Gracias por usarlo! 👍`);
    saveData();
  } else {
    client.sendText(from, '❌ No tienes ningún cotizador asignado para liberar. 🤔');
  }
}

function liberarTodosCotizadores(client, from) {
  cotizadores = cotizadores.map(() => ({ ocupado: false, usuarioId: null }));
  client.sendText(from, '✅ Todos los cotizadores han sido liberados. 🔓');
  saveData();
}

function liberarTurnos(client) {
  turnos = Object.fromEntries(Object.keys(turnos).map(dia => [dia, Array(5).fill('')]));
  const mensaje = "🎉 ¡Turnos de la semana para Marketing Digital liberados! 🎉\n\n" +
                  "Por favor, escoge tus turnos para la próxima semana.\n\n" +
                  "Para ver los turnos disponibles, usa el comando @turnos\n" +
                  "Para tomar tus turnos, usa el comando @tomar [tu nombre] [día1] [día2] [día3]\n" +
                  "Ejemplo: @tomar Juan Lunes Martes Miércoles";

  client.sendLinkPreview("https://chat.whatsapp.com/HZHFRTdPc9UK7LhBx2S4Em", mensaje);
  saveData();
}

function mostrarTurnos(client, from) {
  let mensaje = "Turnos disponibles: 📅\n\n";
  for (let dia in turnos) {
    mensaje += `*${capitalize(dia)}:* ${getEmojiForDay(dia)}\n`;
    turnos[dia].forEach((turno, index) => {
      mensaje += `  Turno ${index + 1}: ${turno || '✅ Disponible'}\n`;
    });
    mensaje += '\n';
  }
  mensaje += "Para tomar tus turnos, usa el comando @tomar [tu nombre] [día1] [día2] [día3]\n" +
             "Ejemplo: @tomar Juan Lunes Martes Miércoles\n\n" +
             "Para liberar un turno, usa el comando @liberarturno [tu nombre] [día]\n" +
             "Ejemplo: @liberarturno Juan Lunes";

  client.sendText(from, mensaje);
}

const getEmojiForDay = (day) => ({ lunes: '🌞', martes: '🌱', miercoles: '🌼', jueves: '🌈', viernes: '🎉', sabado: '🎊' }[day] || '');

function tomarTurno(client, message) {
  const [, nombre, ...dias] = normalizeText(message.body.toLowerCase()).split(' ');
  let turnosAsignados = [];

  dias.forEach(dia => {
    const diaNormalizado = Object.keys(turnos).find(key => normalizeText(key).startsWith(dia));
    if (diaNormalizado) {
      const turnoDisponible = turnos[diaNormalizado].findIndex(turno => turno === '');
      if (turnoDisponible !== -1) {
        turnos[diaNormalizado][turnoDisponible] = nombre;
        turnosAsignados.push(`${capitalize(diaNormalizado)} (Turno ${turnoDisponible + 1})`);
      } else {
        client.sendText(message.from, `No hay turnos disponibles para ${capitalize(diaNormalizado)}`);
      }
    } else {
      client.sendText(message.from, `Día inválido: ${dia}`);
    }
  });

  if (turnosAsignados.length > 0) {
    client.sendText(message.from, `Turnos asignados para ${nombre}:\n${turnosAsignados.join('\n')}`);
    saveData();
  } else {
    client.sendText(message.from, "No se pudo asignar ningún turno.");
  }
}

function liberarTurnoEspecifico(client, message) {
  const [, nombre, dia] = normalizeText(message.body.toLowerCase()).split(' ');
  const diaCapitalizado = Object.keys(turnos).find(key => normalizeText(key).startsWith(dia));

  if (diaCapitalizado) {
    const turnoLiberado = turnos[diaCapitalizado].findIndex(turno => normalizeText(turno) === nombre);
    if (turnoLiberado !== -1) {
      turnos[diaCapitalizado][turnoLiberado] = '';
      client.sendText(message.from, `Turno liberado para ${nombre} el día ${capitalize(diaCapitalizado)} (Turno ${turnoLiberado + 1})`);
      saveData();
    } else {
      client.sendText(message.from, `No se encontró ningún turno para ${nombre} el día ${capitalize(diaCapitalizado)}`);
    }
  } else {
    client.sendText(message.from, `Día inválido: ${dia}`);
  }
}

function liberarHorarioManual(client, from) {
  turnos = Object.fromEntries(Object.keys(turnos).map(dia => [dia, Array(5).fill('')]));
  const mensaje = "🎉 ¡Horario semanal liberado! 🎉\n\n" +
                  "Todos los turnos han sido liberados. Pueden comenzar a tomar nuevos turnos para la próxima semana.\n\n" +
                  "Para ver los turnos disponibles, usa el comando @turnos\n" +
                  "Para tomar tus turnos, usa el comando @tomar [tu nombre] [día1] [día2] [día3]\n" +
                  "Ejemplo: @tomar Juan Lunes Martes Miércoles";

  client.sendText(from, mensaje);
  saveData();
}

const capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1);

const normalizeText = (text) => text.toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[áäà]/g, "a")
  .replace(/[éëè]/g, "e")
  .replace(/[íïì]/g, "i")
  .replace(/[óöò]/g, "o")
  .replace(/[úüù]/g, "u");