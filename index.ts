import {configure, render} from 'nunjucks';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

require('dotenv').config();

const app = express()

configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app
});
app.use(express.static(path.join(__dirname, 'static')))

const port = process.env.PORT ?? 3000

const twimlResponse = fs.readFileSync(path.join(__dirname, 'response.twiml'), 'utf8')
const cacheFile = path.join(__dirname, 'cache.db')

const alarmNumber = process.env.ALARM_PHONE_NUMBER
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

if (alarmNumber == null || twilioPhoneNumber == null) {
  throw new Error(`Invalid config!`)
}

let currentTimeout: ReturnType<typeof setTimeout> | undefined
let currentAlarm: Date | undefined

function setAlarm(time?: Date) {
  if (currentTimeout) {
    clearTimeout(currentTimeout)
    currentTimeout = undefined
    currentAlarm = undefined
  }

  if (time == null) {
    if (fs.existsSync(cacheFile)) {
      fs.rmSync(cacheFile)
    }
    return
  }

  fs.writeFileSync(cacheFile, time.getTime().toString())

  currentTimeout = setTimeout(() => triggerWakeUp()
  .catch((err) => console.error('Failed to make wakeup call', {err})), time.getTime() - (new Date()).getTime())
  currentAlarm = time
}

// Used to restore alarm on power loss
function loadAlarm() {
  if (!fs.existsSync(cacheFile)) {
    return
  }

  const timeStr = fs.readFileSync(cacheFile, 'utf8')
  const time = parseInt(timeStr, 10)
  if (isNaN(time)) {
    console.error(`Failed to parse cached time ${timeStr}`)
    return
  }

  const alarmTime = new Date(time)

  if (alarmTime.getTime() - (new Date().getTime()) < 3 * 60 * 60 * 1000) {
    console.log(`Cached alarm was too old to be restored: ${alarmTime}`)
    setAlarm()
    return;
  }
  setAlarm(alarmTime)

  console.log(`Restored alarm: ${alarmTime}`)
}

app.get('/', (req, res) => {
  const str = render('form.html', {currentAlarm})
  res.send(str);
})

app.get('/test', async (req, res) => {
  try {
    await triggerWakeUp()
    res.send('Triggered call')
  } catch (err) {
    res.status(500)
    res.send(`Error! ${err}`)
  }
})

app.get('/cancel', async (req, res) => {
  const oldAlarm = currentAlarm

  if (currentAlarm) {
    setAlarm()
  }

  const str = render('done.html', {oldAlarm})
  res.send(str);
})

app.get('/setAlarm', (req, res) => {
  const time = req.query.time as string;

  if (time == null) {
    throw new Error('Missing time info!')
  }

  const now = new Date()
  const parsedTime = /^(\d+):(\d+)$/.exec(time)
  if (parsedTime == null) {
    throw new Error(`Invalid time provided ${time}`)
  }

  const newHour = parseInt(parsedTime[1], 10)
  const newMinutes = parseInt(parsedTime[2], 10)

  if (isNaN(newHour) || isNaN(newMinutes)) {
    throw new Error(`Could not parse new time ${time} (${newHour}:${newMinutes})`)
  }

  const alarmTime = new Date(now)

  if (now.getHours() > newHour || (now.getHours() == newHour && now.getMinutes() > newMinutes)) {
    // Next day
    alarmTime.setHours(alarmTime.getHours() + 24)
  }

  console.log(`Now: ${now}, alarm: ${alarmTime}`)

  alarmTime.setHours(newHour)
  alarmTime.setMinutes(newMinutes)

  setAlarm(alarmTime)

  const str = render('done.html', {alarmTime})
  res.send(str);
})

async function triggerWakeUp() {
  setAlarm()

  console.log('Making wakeup call')

  // Call alarm phone number and route to /voiceResponse to detect user input
  await twilio.calls.create({
    twiml: twimlResponse,
    to: alarmNumber,
    from: twilioPhoneNumber,
  })
}

app.listen(port, () => {
  console.log(`Wake up app listening on port ${port}`)
  loadAlarm()
})