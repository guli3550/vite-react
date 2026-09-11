import * as THREE from "three";
import { AGENT_CONFIGS, AgentConfig, AgentStatus } from "./types";

export interface AgentCharacter3D {
  id: string;
  config: AgentConfig;
  group: THREE.Group;
  status: AgentStatus;
  currentTaskName: string;
  setStatus: (status: AgentStatus, taskName?: string) => void;
  moveTo: (x: number, z: number, onArrival?: () => void) => void;
  returnToDesk: () => void;
  update: (delta: number, elapsed: number) => void;
  hitMeshes: THREE.Mesh[];
}

/**
 * Generates an overhead billboard sprite showing agent name, icon, and live status badge
 */
function createStatusBadgeSprite(config: AgentConfig, status: AgentStatus, activityText = ""): {
  sprite: THREE.Sprite;
  updateBadge: (status: AgentStatus, activity: string) => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.9, 0.8, 1);
  sprite.position.set(0, 2.2, 0);

  const draw = (curStatus: AgentStatus, curActivity: string) => {
    ctx.clearRect(0, 0, 384, 160);

    // Pill container with shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    roundRect(ctx, 16, 16, 352, 128, 28);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";

    // Glowing border in agent color
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 4;
    roundRect(ctx, 16, 16, 352, 128, 28);
    ctx.stroke();

    // Agent Icon & Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${config.icon} ${config.nameUz}`, 36, 56);

    // Status Pill Badge
    let statusBg = "#10b981";
    let statusText = "Faol";
    if (curStatus === "working") {
      statusBg = "#0284c7";
      statusText = "Ishlamoqda";
    } else if (curStatus === "thinking") {
      statusBg = "#f59e0b";
      statusText = "O‘ylamoqda";
    } else if (curStatus === "error") {
      statusBg = "#ef4444";
      statusText = "Xatolik";
    } else if (curStatus === "idle") {
      statusBg = "#64748b";
      statusText = "Kutmoqda";
    }

    ctx.fillStyle = statusBg;
    roundRect(ctx, 36, 90, 140, 36, 18);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(statusText, 106, 108);

    // Sub-text or task
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "500 18px 'Plus Jakarta Sans', sans-serif";
    const subStr = curActivity ? truncate(curActivity, 18) : config.roleUz;
    ctx.fillText(subStr, 188, 108);

    texture.needsUpdate = true;
  };

  draw(status, activityText);

  return {
    sprite,
    updateBadge: draw,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(s: string, len: number) {
  return s.length > len ? s.slice(0, len) + "…" : s;
}

/**
 * Builds a stylish, articulate 3D human character avatar with realistic proportions and animations
 */
export function buildAgentCharacter(id: string, isLiteMode = false): AgentCharacter3D {
  const config = AGENT_CONFIGS[id] || AGENT_CONFIGS.orchestrator;
  const group = new THREE.Group();
  group.position.set(config.deskPos[0], 0, config.deskPos[2] + 0.65);
  group.rotation.y = config.deskRotY;

  const hitMeshes: THREE.Mesh[] = [];

  // ===================== MATERIALS =====================
  const skinMat = new THREE.MeshStandardMaterial({
    color: config.skinTone,
    roughness: 0.6,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: config.hairColor,
    roughness: 0.8,
  });
  const outfitMat = new THREE.MeshStandardMaterial({
    color: config.outfitColor,
    roughness: 0.5,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark slate trousers
    roughness: 0.6,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16, // Leather black shoes
    roughness: 0.3,
  });

  // ===================== SKELETAL HIERARCHY =====================
  // Root Pelvis
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.54; // Seated height on chair
  group.add(pelvis);

  // Torso / Chest
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.12;
  pelvis.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.46, 0.26),
    outfitMat
  );
  torsoMesh.position.y = 0.23;
  torsoMesh.castShadow = !isLiteMode;
  torsoGroup.add(torsoMesh);
  hitMeshes.push(torsoMesh);

  // Tie or collar badge if executive
  if (config.hasTie) {
    const tieMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 })
    );
    tieMesh.position.set(0, 0.2, 0.14);
    torsoGroup.add(tieMesh);
  }

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10),
    skinMat
  );
  neck.position.y = 0.48;
  torsoGroup.add(neck);

  // Head Group (rotates during looking & thinking)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.54;
  torsoGroup.add(headGroup);

  // Face / Head mesh
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 14),
    skinMat
  );
  headMesh.scale.set(1.0, 1.15, 1.0);
  headMesh.position.y = 0.14;
  headMesh.castShadow = !isLiteMode;
  headGroup.add(headMesh);
  hitMeshes.push(headMesh);

  // Hair
  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 14, 14),
    hairMat
  );
  hairMesh.scale.set(1.02, 1.05, 1.08);
  hairMesh.position.set(0, 0.18, -0.02);
  headGroup.add(hairMesh);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
  eyeL.position.set(-0.06, 0.15, 0.145);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
  eyeR.position.set(0.06, 0.15, 0.145);
  headGroup.add(eyeR);

  // Glasses for Security / Payment
  if (config.hasGlasses) {
    const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
    const frameL = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 8, 16), glassFrameMat);
    frameL.position.set(-0.06, 0.15, 0.155);
    headGroup.add(frameL);

    const frameR = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 8, 16), glassFrameMat);
    frameR.position.set(0.06, 0.15, 0.155);
    headGroup.add(frameR);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), glassFrameMat);
    bridge.position.set(0, 0.15, 0.155);
    headGroup.add(bridge);
  }

  // Audio Headset for Customer Support
  if (config.hasHeadset) {
    const headsetMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
    // Headband
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24, Math.PI), headsetMat);
    band.rotation.x = -Math.PI / 2;
    band.position.set(0, 0.18, 0);
    headGroup.add(band);

    // Earpads
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), headsetMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.17, 0.14, 0);
    headGroup.add(earL);

    const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), headsetMat);
    earR.rotation.z = Math.PI / 2;
    earR.position.set(0.17, 0.14, 0);
    headGroup.add(earR);

    // Mic boom
    const micBoom = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.01), headsetMat);
    micBoom.position.set(0.08, 0.08, 0.12);
    micBoom.rotation.y = -Math.PI * 0.25;
    headGroup.add(micBoom);
  }

  // ===================== ARMS =====================
  // Left Shoulder & Arm
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.25, 0.4, 0);
  torsoGroup.add(leftArmGroup);

  const upperArmL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.045, 0.26, 10),
    outfitMat
  );
  upperArmL.position.y = -0.13;
  leftArmGroup.add(upperArmL);

  const forearmGroupL = new THREE.Group();
  forearmGroupL.position.y = -0.26;
  leftArmGroup.add(forearmGroupL);

  const lowerArmL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.038, 0.24, 10),
    skinMat
  );
  lowerArmL.position.y = -0.12;
  forearmGroupL.add(lowerArmL);

  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
  handL.position.y = -0.24;
  forearmGroupL.add(handL);

  // Right Shoulder & Arm
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.25, 0.4, 0);
  torsoGroup.add(rightArmGroup);

  const upperArmR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.045, 0.26, 10),
    outfitMat
  );
  upperArmR.position.y = -0.13;
  rightArmGroup.add(upperArmR);

  const forearmGroupR = new THREE.Group();
  forearmGroupR.position.y = -0.26;
  rightArmGroup.add(forearmGroupR);

  const lowerArmR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.038, 0.24, 10),
    skinMat
  );
  lowerArmR.position.y = -0.12;
  forearmGroupR.add(lowerArmR);

  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
  handR.position.y = -0.24;
  forearmGroupR.add(handR);

  // ===================== LEGS =====================
  // Left Leg
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.13, 0, 0);
  pelvis.add(leftLegGroup);

  const upperLegL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), pantsMat);
  upperLegL.position.set(0, 0, 0.16);
  leftLegGroup.add(upperLegL);

  const shinL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.13), pantsMat);
  shinL.position.set(0, -0.24, 0.32);
  leftLegGroup.add(shinL);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), shoeMat);
  shoeL.position.set(0, -0.48, 0.38);
  leftLegGroup.add(shoeL);

  // Right Leg
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.13, 0, 0);
  pelvis.add(rightLegGroup);

  const upperLegR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), pantsMat);
  upperLegR.position.set(0, 0, 0.16);
  rightLegGroup.add(upperLegR);

  const shinR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.13), pantsMat);
  shinR.position.set(0, -0.24, 0.32);
  rightLegGroup.add(shinR);

  const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), shoeMat);
  shoeR.position.set(0, -0.48, 0.38);
  rightLegGroup.add(shoeR);

  // Setup initial sitting posture: arms facing forward towards desk
  leftArmGroup.rotation.x = -Math.PI * 0.42;
  leftArmGroup.rotation.z = Math.PI * 0.1;
  forearmGroupL.rotation.x = -Math.PI * 0.35;

  rightArmGroup.rotation.x = -Math.PI * 0.42;
  rightArmGroup.rotation.z = -Math.PI * 0.1;
  forearmGroupR.rotation.x = -Math.PI * 0.35;

  // ===================== STATUS BADGE SPRITE =====================
  const { sprite: badgeSprite, updateBadge } = createStatusBadgeSprite(config, "idle");
  group.add(badgeSprite);

  // Dynamic state
  let currentStatus: AgentStatus = "idle";
  let curTask = "";

  // Walking & Navigation state
  let isWalking = false;
  const walkTarget = new THREE.Vector3();
  let walkOnArrival: (() => void) | null = null;
  const walkSpeed = 2.4;

  const setStatus = (status: AgentStatus, taskName?: string) => {
    currentStatus = status;
    curTask = taskName || "";
    updateBadge(currentStatus, curTask);
  };

  const moveTo = (tx: number, tz: number, onArrival?: () => void) => {
    walkTarget.set(tx, 0, tz);
    walkOnArrival = onArrival || null;
    isWalking = true;

    // Switch posture to standing for walking
    pelvis.position.y = 0.88;
    upperLegL.position.set(0, -0.2, 0);
    upperLegL.rotation.x = 0;
    shinL.position.set(0, -0.58, 0);
    shoeL.position.set(0, -0.84, 0.04);

    upperLegR.position.set(0, -0.2, 0);
    upperLegR.rotation.x = 0;
    shinR.position.set(0, -0.58, 0);
    shoeR.position.set(0, -0.84, 0.04);
  };

  const returnToDesk = () => {
    moveTo(config.deskPos[0], config.deskPos[2] + 0.65, () => {
      // Revert to seated posture
      group.rotation.y = config.deskRotY;
      pelvis.position.y = 0.54;

      upperLegL.position.set(0, 0, 0.16);
      shinL.position.set(0, -0.24, 0.32);
      shoeL.position.set(0, -0.48, 0.38);

      upperLegR.position.set(0, 0, 0.16);
      shinR.position.set(0, -0.24, 0.32);
      shoeR.position.set(0, -0.48, 0.38);
    });
  };

  // Tag group and hit meshes with agentId for Raycasting
  group.userData = { agentId: id, type: "agent_character" };
  hitMeshes.forEach((m) => {
    m.userData = { agentId: id, type: "agent_character" };
  });

  // ===================== ANIMATION UPDATE =====================
  const update = (delta: number, elapsed: number) => {
    const timeOffset = id.length * 1.4;

    if (isWalking) {
      // Move along ground plane towards target
      const currentPos = new THREE.Vector2(group.position.x, group.position.z);
      const targetPos = new THREE.Vector2(walkTarget.x, walkTarget.z);
      const dist = currentPos.distanceTo(targetPos);

      if (dist < 0.1) {
        isWalking = false;
        group.position.x = walkTarget.x;
        group.position.z = walkTarget.z;
        leftLegGroup.rotation.x = 0;
        rightLegGroup.rotation.x = 0;
        leftArmGroup.rotation.x = -Math.PI * 0.42;
        rightArmGroup.rotation.x = -Math.PI * 0.42;
        if (walkOnArrival) {
          walkOnArrival();
          walkOnArrival = null;
        }
      } else {
        const dir = targetPos.clone().sub(currentPos).normalize();
        group.position.x += dir.x * walkSpeed * delta;
        group.position.z += dir.y * walkSpeed * delta;

        // Turn towards walking direction
        const angle = Math.atan2(dir.x, dir.y);
        group.rotation.y = angle;

        // Walk cycle leg swings & arm counter-swings
        const walkCycle = (elapsed + timeOffset) * 9;
        leftLegGroup.rotation.x = Math.sin(walkCycle) * 0.6;
        rightLegGroup.rotation.x = -Math.sin(walkCycle) * 0.6;
        leftArmGroup.rotation.x = -Math.sin(walkCycle) * 0.5;
        rightArmGroup.rotation.x = Math.sin(walkCycle) * 0.5;

        // Subtle torso bounce
        pelvis.position.y = 0.88 + Math.abs(Math.sin(walkCycle * 2)) * 0.04;
      }
      return;
    }

    // Sitting Animations per Status:
    if (currentStatus === "working") {
      // Dynamic Typing Animation on Keyboard
      const typeFreq = 16 + (id.charCodeAt(0) % 5);
      const leftKey = Math.sin((elapsed + timeOffset) * typeFreq);
      const rightKey = Math.cos((elapsed + timeOffset) * typeFreq + 1);

      leftArmGroup.rotation.x = -Math.PI * 0.42 + leftKey * 0.06;
      forearmGroupL.rotation.x = -Math.PI * 0.35 + leftKey * 0.08;

      rightArmGroup.rotation.x = -Math.PI * 0.42 + rightKey * 0.06;
      forearmGroupR.rotation.x = -Math.PI * 0.35 + rightKey * 0.08;

      // Head scanning across dual screens
      headGroup.rotation.y = Math.sin((elapsed + timeOffset) * 1.8) * 0.22;
      headGroup.rotation.x = -0.05 + Math.sin((elapsed + timeOffset) * 3) * 0.03;

      // Breathing / concentration
      torsoGroup.position.y = 0.12 + Math.sin(elapsed * 4) * 0.01;
    } else if (currentStatus === "thinking") {
      // Hand to chin / thoughtful head tilt
      leftArmGroup.rotation.x = -Math.PI * 0.35;
      forearmGroupL.rotation.x = -Math.PI * 0.25;

      // Right hand touches chin
      rightArmGroup.rotation.x = -Math.PI * 0.72;
      rightArmGroup.rotation.z = -Math.PI * 0.3;
      forearmGroupR.rotation.x = -Math.PI * 0.6;

      // Head tilted upwards
      headGroup.rotation.y = 0.15;
      headGroup.rotation.x = -0.22 + Math.sin(elapsed * 2) * 0.04;

      // Slow deep breathing
      torsoGroup.position.y = 0.12 + Math.sin(elapsed * 2) * 0.015;
    } else if (currentStatus === "error") {
      // Concerned head scratching & alert shaking
      rightArmGroup.rotation.x = -Math.PI * 0.85;
      rightArmGroup.rotation.z = -Math.PI * 0.4;
      forearmGroupR.rotation.x = -Math.PI * 0.7;

      headGroup.rotation.y = Math.sin(elapsed * 6) * 0.2;
      headGroup.rotation.x = 0.1;
      torsoGroup.position.y = 0.12;
    } else {
      // IDLE: Relaxed, subtle breathing, looking around
      const breath = Math.sin((elapsed + timeOffset) * 2.2);
      torsoGroup.position.y = 0.12 + breath * 0.012;
      torsoGroup.scale.set(1.0 + breath * 0.015, 1.0 + breath * 0.015, 1.0 + breath * 0.015);

      // Relaxed resting arms
      leftArmGroup.rotation.x = -Math.PI * 0.38 + breath * 0.02;
      forearmGroupL.rotation.x = -Math.PI * 0.3;

      rightArmGroup.rotation.x = -Math.PI * 0.38 + breath * 0.02;
      forearmGroupR.rotation.x = -Math.PI * 0.3;

      // Casual head gaze
      headGroup.rotation.y = Math.sin((elapsed + timeOffset) * 0.8) * 0.18;
      headGroup.rotation.x = Math.cos((elapsed + timeOffset) * 1.1) * 0.06;
    }
  };

  return {
    id,
    config,
    group,
    status: currentStatus,
    currentTaskName: curTask,
    setStatus,
    moveTo,
    returnToDesk,
    update,
    hitMeshes,
  };
}
