let missiles = [];
let particles = [];
let stars = [];

let shieldRadius = 55; // 타겟 크기 (고정)
let shieldPadding = 15; // 보호막과 타겟 사이 거리
let shieldThickness = 8;
let shieldDepletion = 0; // 실드 감소량 (0~1)
let shieldWarning = 20; // 내구도 경고를 시작할 수치
let extraHits = 0;
let maxExtraHits = 2;

let isGameOver = false;

let shakePower = 0;
let shakeDecay = 0.95;
let shakeOffset;

let corePos;
let coreVel;
let coreAcc;
let coreMaxSpeed = 7;
let coreMaxForce = 0.5;

let dungGeunMoFont;
let deathSound;
let explosionSound;

function preload() {
  dungGeunMoFont = loadFont(
    "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff"
  );
  explosionSound = loadSound("explosion.mp3");
  deathSound = loadSound("death.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  shakeOffset = createVector(0, 0);
  textFont(dungGeunMoFont);

  //타겟의 위치
  corePos = createVector(width / 2, height / 2);
  coreVel = createVector(0, 0);
  coreAcc = createVector(0, 0);

  // 별 생성
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      alpha: random(100, 255),
    });
  }

  for (let i = 0; i < 25; i++) {
    let delay = random(3000, 15000);
    setTimeout(() => {
      if (!isGameOver) {
        missiles.push(new Missile(random(width), random(height)));
      }
    }, delay);
  }
}

function mousePressed() {
  userStartAudio();
  explosionSound.setVolume(0.1);
}

function draw() {
  background("#091624");

  // 별 배경
  noStroke();
  for (let star of stars) {
    fill(255, star.alpha);
    circle(star.x, star.y, star.size);
  }

  //우주선의 이동 설정
  let mouseTarget = createVector(mouseX, mouseY);
  let desired = p5.Vector.sub(mouseTarget, corePos);
  let d = desired.mag();

  let speed = coreMaxSpeed;
  if (d < 100) {
    speed = map(d, 0, 100, 0, coreMaxSpeed);
  }
  desired.setMag(speed);

  let steer = p5.Vector.sub(desired, coreVel);
  steer.limit(coreMaxForce);
  coreAcc.add(steer);

  coreVel.add(coreAcc);
  coreVel.limit(coreMaxSpeed);
  corePos.add(coreVel);
  coreAcc.mult(0);

  // 쉐이크 적용
  shakeOffset = p5.Vector.random2D().mult(shakePower);
  shakePower *= shakeDecay;
  let shakenTarget = p5.Vector.add(corePos, shakeOffset);

  // 보호막 두께 계산 (패딩이 감소)
  let effectivePadding = shieldPadding * (1 - shieldDepletion);

  // 보호막 그리기 (내구도 0이면 숨김)
  // if (shieldDepletion < 1) {
  //   noFill();
  //   stroke(0, 255, 255);
  //   strokeWeight(shieldThickness);
  //   ellipse(
  //     shakenTarget.x,
  //     shakenTarget.y,
  //     (shieldRadius + effectivePadding) * 2,
  //     (shieldRadius + effectivePadding) * 1.3
  //   );
  // }
  if (shieldDepletion < 1) {
    noFill();

    // 내구도 기준으로 보호막 색상 결정
    if (1 - shieldDepletion <= shieldWarning / 100) {
      // 경고 기준 이하면 빨간색 깜빡임
      if (floor(frameCount / 30) % 2 == 0) {
        stroke(255, 0, 0); // 빨간색
      } else {
        stroke(0, 255, 255); // 원래 cyan
      }
    } else {
      stroke(0, 255, 255);
    }

    let currentThickness = round(shieldThickness * (1 - shieldDepletion));
    strokeWeight(currentThickness);

    ellipse(
      shakenTarget.x,
      shakenTarget.y,
      (shieldRadius + shieldPadding) * 2,
      (shieldRadius + shieldPadding) * 1.3
    );
  }

  // // 타겟 본체 (항상 고정)
  // if (!isGameOver) {
  //   fill(127);
  //   stroke(0);
  //   strokeWeight(2);
  //   ellipse(
  //     shakenTarget.x,
  //     shakenTarget.y,
  //     shieldRadius * 2,
  //     shieldRadius * 1.3
  //   );
  // }

  // 타겟 본체 (항상 고정)
  if (!isGameOver) {
    push();
    translate(shakenTarget.x, shakenTarget.y);
    rotate(coreVel.heading());

    textAlign(CENTER, CENTER);
    textSize(shieldRadius * 0.8);
    textFont("Segoe UI Emoji");

    text("🚀", 0, 0);
    pop();
  }

  // 미사일 업데이트
  for (let i = missiles.length - 1; i >= 0; i--) {
    let m = missiles[i];
    m.arrive(corePos);
    m.update();
    m.show();

    let d = p5.Vector.dist(m.pos, shakenTarget);
    if (d < shieldRadius + shieldPadding) {
      if (!isGameOver) {
        if (shieldDepletion < 1) {
          spawnParticles(m.pos.copy(), m.vel.copy());
          shieldDepletion = min(shieldDepletion + 0.05, 1);
        } else {
          extraHits++;
          spawnParticles(m.pos.copy(), m.vel.copy());

          if (extraHits >= maxExtraHits) {
            isGameOver = true;
            spawnCoreExplosion(shakenTarget);

            deathSound.play();
          }
        }
      }
      missiles.splice(i, 1);
      shakePower += 5;
    }
  }

  // 파편 업데이트
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.show();
    if (p.isDead()) {
      particles.splice(i, 1);
    }
  }

  // 보호막 내구도 표시
  let durability = Math.round((1 - shieldDepletion) * 100);

  let textX = 20;
  let textY = height - 20;

  // 색상 결정
  if (durability <= shieldWarning) {
    fill(255, 0, 0);
    textX += shakeOffset.x;
    textY += shakeOffset.y;

    // HUD 경고 추가
    push();

    noStroke();
    fill(255, 0, 0);
    textAlign(LEFT, TOP);
    textSize(48);
    text("WARNING", 20 + shakeOffset.x, 20 + shakeOffset.y);

    let boxWidth = 220;
    let boxHeight = 120;
    let margin = 20;

    let boxX = width - boxWidth - margin + shakeOffset.x;
    let boxY = margin + shakeOffset.y;

    noFill();
    stroke(255, 0, 0, 200);
    strokeWeight(2);
    rect(boxX, boxY, boxWidth, boxHeight, 1);

    noStroke();
    fill(255, 0, 0);

    // 왼쪽 정렬
    textAlign(LEFT, TOP);

    let padding = 15;
    let startX = boxX + padding;
    let startY = boxY + padding;

    // 메인 경고 텍스트
    textSize(20);
    text("CRITICAL DAMAGE", startX, startY);

    // 서브텍스트 간격 좁혀서
    textSize(12);
    let lineGap = 16; // 줄 간격
    let subStartY = startY + 10;

    text("SYSTEM INSTABILITY DETECTED", startX, subStartY + lineGap * 1);
    text("CORE TEMPERATURE RISING", startX, subStartY + lineGap * 2);
    text("EMERGENCY POWER ROUTING ENGAGED", startX, subStartY + lineGap * 3);
    text("IMMINENT SYSTEM FAILURE", startX, subStartY + lineGap * 4);

    pop();
  } else {
    fill(255);
  }

  noStroke();
  textSize(30);
  textAlign(LEFT, BOTTOM);

  // 기존 shakeOffset을 그대로 사용
  text(`SHIELD: ${durability}%`, textX, textY);

  // GAME OVER 표시
  if (isGameOver) {
    textSize(80);
    textAlign(CENTER, CENTER);

    // 흔들림 적용
    let gameOverX = width / 2 + shakeOffset.x;
    let gameOverY = height / 2 + shakeOffset.y;

    fill(255);
    text("YOU ARE DEAD", gameOverX, gameOverY);
  }
}

function spawnParticles(position, incomingVelocity) {
  explosionSound.play();

  for (let i = 0; i < 3; i++) {
    let vel = p5.Vector.mult(incomingVelocity, -1);
    vel.add(p5.Vector.random2D().mult(2));
    particles.push(new Particle(position, vel));
  }
}

function spawnCoreExplosion(position) {
  for (let i = 0; i < 30; i++) {
    let vel = p5.Vector.random2D().mult(random(2, 5));
    particles.push(new Particle(position, vel));
  }
}

class Missile {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector();
    this.acc = createVector();
    this.maxSpeed = 5;
    this.maxForce = 0.3;
  }

  arrive(target) {
    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();

    let speed = this.maxSpeed;
    if (d < 100) {
      speed = map(d, 0, 100, 0, this.maxSpeed);
    }
    desired.setMag(speed);

    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    this.applyForce(steer);
  }

  applyForce(f) {
    this.acc.add(f);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  // show() {
  //   push();
  //   translate(this.pos.x, this.pos.y);
  //   rotate(this.vel.heading());
  //   fill(220);
  //   stroke(0);
  //   strokeWeight(1);
  //   beginShape();
  //   vertex(16, 0);
  //   vertex(-10, -6);
  //   vertex(-10, 6);
  //   endShape(CLOSE);
  //   pop();
  // }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    textAlign(CENTER, CENTER);
    textSize(20);
    textFont("sans-serif");
    text("🪨", 0, 0);
    pop();
  }
}

class Particle {
  constructor(pos, vel) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.lifespan = 255;
  }

  update() {
    this.pos.add(this.vel);
    this.lifespan -= 5;
  }

  show() {
    noStroke();
    fill(255, 50, 0, this.lifespan);
    ellipse(this.pos.x, this.pos.y, 8);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}
