let missiles = [];
let particles = [];
let stars = [];

let shieldRadius = 48; // 타겟 크기 (고정)
let shieldPadding = 10; // 보호막 두께 (이게 닳아감)
let shieldThickness = 4;
let shieldDepletion = 0; // 실드 감소량 (0~1)
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

function preload() {
  dungGeunMoFont = loadFont(
    "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/DungGeunMo.woff"
  );
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

  for (let i = 0; i < 30; i++) {
    let delay = random(3000, 15000);
    setTimeout(() => {
      if (!isGameOver) {
        missiles.push(new Missile(random(width), random(height)));
      }
    }, delay);
  }
}

function draw() {
  background(0, 30, 60);

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
  if (shieldDepletion < 1) {
    noFill();
    stroke(0, 255, 255);
    strokeWeight(shieldThickness);
    ellipse(
      shakenTarget.x,
      shakenTarget.y,
      (shieldRadius + effectivePadding) * 2,
      (shieldRadius + effectivePadding) * 1.3
    );
  }

  // 타겟 본체 (항상 고정)
  if (!isGameOver) {
    fill(127);
    stroke(0);
    strokeWeight(2);
    ellipse(
      shakenTarget.x,
      shakenTarget.y,
      shieldRadius * 2,
      shieldRadius * 1.3
    );
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
  if (durability <= 20) {
    fill(255, 0, 0);
    textX += shakeOffset.x;
    textY += shakeOffset.y;
  } else {
    fill(255);
  }

  noStroke();
  textSize(20);
  textAlign(LEFT, BOTTOM);

  // 기존 shakeOffset을 그대로 사용
  text(`Shield: ${durability}%`, textX, textY);

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

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    fill(220);
    stroke(0);
    strokeWeight(1);
    beginShape();
    vertex(16, 0);
    vertex(-10, -6);
    vertex(-10, 6);
    endShape(CLOSE);
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
    fill(255, 100, 0, this.lifespan);
    ellipse(this.pos.x, this.pos.y, 8);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}
