#include <Servo.h>

// Calibrate these before attaching the linkage.
const byte SERVO_PIN = 9;
const byte RED_LED_PIN = 4;
const byte AMBER_LED_PIN = 5;
const byte GREEN_LED_PIN = 6;
const byte BUZZER_PIN = 8;
const byte CLOSED_ANGLE = 12;
const byte OPEN_ANGLE = 92;
const byte REJECT_ANGLE = 27;
const unsigned long OPEN_WARNING_MS = 10000;

enum CueMode { CUE_OFF, CUE_IDLE, CUE_SCAN, CUE_REFUSE, CUE_ACCEPT };

Servo lid;
int currentAngle = CLOSED_ANGLE;
bool armed = false;
bool muted = false;
bool lidOpenWarningSent = false;
CueMode cueMode = CUE_OFF;
unsigned long cueStartedAt = 0;
unsigned long lidOpenedAt = 0;

void setLights(bool red, bool amber, bool green) {
  digitalWrite(RED_LED_PIN, red ? HIGH : LOW);
  digitalWrite(AMBER_LED_PIN, amber ? HIGH : LOW);
  digitalWrite(GREEN_LED_PIN, green ? HIGH : LOW);
}

void playTone(unsigned int frequency, unsigned long duration) {
  if (!muted) tone(BUZZER_PIN, frequency, duration);
}

void setCue(CueMode nextCue) {
  cueMode = nextCue;
  cueStartedAt = millis();
  noTone(BUZZER_PIN);
  if (nextCue == CUE_OFF) {
    setLights(false, false, false);
  } else if (nextCue == CUE_IDLE) {
    setLights(false, true, false);
  } else if (nextCue == CUE_SCAN) {
    setLights(false, true, false);
    playTone(330, 55);
  } else if (nextCue == CUE_REFUSE) {
    setLights(true, false, false);
    playTone(165, 320);
  } else if (nextCue == CUE_ACCEPT) {
    setLights(false, false, true);
    playTone(1047, 260);
  }
}

void updateEffects() {
  unsigned long elapsed = millis() - cueStartedAt;
  if (cueMode == CUE_SCAN) {
    bool flash = (elapsed % 700 < 110) || (elapsed % 700 > 210 && elapsed % 700 < 320);
    setLights(false, flash, false);
  } else if (cueMode == CUE_REFUSE && elapsed < 1050) {
    setLights((elapsed / 150) % 2 == 0, false, false);
  } else if (cueMode == CUE_ACCEPT && elapsed < 900) {
    setLights(false, false, (elapsed / 180) % 2 == 0);
  } else if (cueMode == CUE_ACCEPT) {
    setLights(false, false, true);
  }

  if (armed && currentAngle == OPEN_ANGLE && millis() - lidOpenedAt >= OPEN_WARNING_MS) {
    if (!lidOpenWarningSent) {
      Serial.println("WARN LID OPEN");
      lidOpenWarningSent = true;
      playTone(440, 90);
    }
    bool phase = (millis() / 500) % 2 == 0;
    setLights(phase, !phase, false);
  }
}

void moveTo(int target, bool releaseAfter = true) {
  target = constrain(target, 0, 180);
  if (!lid.attached()) lid.attach(SERVO_PIN);

  int direction = target > currentAngle ? 1 : -1;
  while (currentAngle != target) {
    currentAngle += direction;
    lid.write(currentAngle);
    delay(10);
  }

  delay(120);
  if (releaseAfter) lid.detach();
}

void closeLid() {
  moveTo(CLOSED_ANGLE);
  lidOpenWarningSent = false;
  setCue(CUE_IDLE);
  Serial.println("OK CLOSED");
}

void rejectTrash() {
  // Never close implicitly; the presenter must explicitly clear and close an open lid.
  if (currentAngle != CLOSED_ANGLE) {
    Serial.println("ERR LID OPEN");
    return;
  }
  setCue(CUE_REFUSE);
  moveTo(REJECT_ANGLE, false);
  moveTo(CLOSED_ANGLE, false);
  moveTo(REJECT_ANGLE, false);
  moveTo(CLOSED_ANGLE);
  Serial.println("OK REJECT");
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(60);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(AMBER_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  setCue(CUE_OFF);

  // Do not move on boot: opening a serial port resets many Uno/Nano boards.
  // The presenter must place the lightweight lid closed and explicitly ARM it.
  Serial.println("READY");
}

void loop() {
  updateEffects();
  if (!Serial.available()) return;

  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toUpperCase();

  if (command == "PING") {
    Serial.println("READY");
  } else if (command == "ARM") {
    armed = true;
    currentAngle = CLOSED_ANGLE;
    lidOpenWarningSent = false;
    setCue(CUE_IDLE);
    Serial.println("OK ARMED");
  } else if (command == "DISARM") {
    if (currentAngle != CLOSED_ANGLE) {
      Serial.println("ERR LID OPEN");
    } else {
      armed = false;
      if (lid.attached()) lid.detach();
      setCue(CUE_OFF);
      Serial.println("OK DISARMED");
    }
  } else if (!armed) {
    Serial.println("ERR NOT ARMED");
  } else if (command == "CUE IDLE") {
    setCue(CUE_IDLE);
    Serial.println("OK CUE IDLE");
  } else if (command == "CUE SCAN") {
    setCue(CUE_SCAN);
    Serial.println("OK CUE SCAN");
  } else if (command == "CUE REFUSE") {
    setCue(CUE_REFUSE);
    Serial.println("OK CUE REFUSE");
  } else if (command == "CUE ACCEPT") {
    setCue(CUE_ACCEPT);
    Serial.println("OK CUE ACCEPT");
  } else if (command == "CUE OFF") {
    setCue(CUE_OFF);
    Serial.println("OK CUE OFF");
  } else if (command == "MUTE ON") {
    muted = true;
    noTone(BUZZER_PIN);
    Serial.println("OK MUTE ON");
  } else if (command == "MUTE OFF") {
    muted = false;
    Serial.println("OK MUTE OFF");
  } else if (command == "OPEN") {
    // Hold torque while open so a gravity-loaded lid cannot fall shut.
    setCue(CUE_ACCEPT);
    moveTo(OPEN_ANGLE, false);
    lidOpenedAt = millis();
    lidOpenWarningSent = false;
    Serial.println("OK OPEN");
  } else if (command == "CLOSE") {
    closeLid();
  } else if (command == "REJECT") {
    rejectTrash();
  } else {
    Serial.println("ERR UNKNOWN");
  }
}
