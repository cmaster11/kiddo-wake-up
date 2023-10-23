# kiddo-wake-up

A self-hosted nodejs app that lets my wife setup a wakeup time for me via a form.

When the time is nigh, the app makes a phone call via Twilio to my personal phone, which in turn makes my wristband vibrate and wakes me up! Time to feed the kiddo!

Plus, the Twilio call is free because I use the `Reject` verb in the call configuration.

## .env

Expects a `.env` file with the format:

```
TWILIO_ACCOUNT_SID=XXXX
TWILIO_AUTH_TOKEN=XXXX
TWILIO_PHONE_NUMBER=+123456
ALARM_PHONE_NUMBER=+123456
# Webserver listening port
PORT=9999
```