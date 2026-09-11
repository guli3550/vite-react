import * as THREE from "three";
import { AGENT_CONFIGS } from "./types";

export interface OfficeSceneHandles {
  scene: THREE.Scene;
  update: (delta: number, elapsed: number) => void;
  serverLeds: THREE.Mesh[];
  screenMaterials: THREE.MeshBasicMaterial[];
  zoneHitBoxes: THREE.Mesh[];
}

/**
 * Creates dynamic textures on canvas for displays, signage, and floor
 */
function createFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Warm, premium light parquet / terrazzo tile base
  ctx.fillStyle = "#f4efe9";
  ctx.fillRect(0, 0, 512, 512);

  // Modern floor tile grid lines
  ctx.strokeStyle = "rgba(180, 160, 150, 0.25)";
  ctx.lineWidth = 2;
  const tileSize = 64;
  for (let x = 0; x <= 512; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Subtle natural wood grain speckles
  ctx.fillStyle = "rgba(140, 120, 110, 0.04)";
  for (let i = 0; i < 600; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillRect(rx, ry, Math.random() * 4 + 1, Math.random() * 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 10);
  return texture;
}

function createSkylineTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  // Dusk sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#090d16");
  grad.addColorStop(0.6, "#151c2e");
  grad.addColorStop(0.85, "#4c1d3f"); // Warm rose dusk glow
  grad.addColorStop(1, "#831843");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Distant stars / night sky
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 150; i++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 280;
    const sr = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // City skyscrapers silhouettes
  ctx.fillStyle = "#0c101d";
  let curX = 0;
  while (curX < 1024) {
    const w = 24 + Math.random() * 45;
    const h = 120 + Math.random() * 240;
    const top = 512 - h;
    ctx.fillRect(curX, top, w, h);

    // Glowing window dots on buildings
    ctx.fillStyle = Math.random() > 0.3 ? "rgba(254, 240, 138, 0.6)" : "rgba(147, 197, 253, 0.6)";
    for (let wy = top + 15; wy < 500; wy += 14) {
      for (let wx = curX + 5; wx < curX + w - 5; wx += 9) {
        if (Math.random() > 0.45) {
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.fillStyle = "#0c101d";
    curX += w + 4;
  }

  return new THREE.CanvasTexture(canvas);
}

function createBrandSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1e1b2e";
  ctx.fillRect(0, 0, 512, 128);

  // Border glow
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GULI · AI OPERATIONS", 256, 48);

  ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#fb7185";
  ctx.fillText("AUTONOMOUS AGENT COMMAND CENTER", 256, 92);

  return new THREE.CanvasTexture(canvas);
}

function createScreenTexture(title: string, sub: string, accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;

  // Dark terminal background
  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 256, 160);

  // Header bar
  ctx.fillStyle = "#161e2e";
  ctx.fillRect(0, 0, 256, 28);

  ctx.fillStyle = accentColor;
  ctx.fillRect(8, 7, 14, 14);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px monospace";
  ctx.fillText(title, 28, 20);

  // Fake chart or code lines
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "11px monospace";
  ctx.fillText(`STATUS: LIVE`, 12, 48);
  ctx.fillText(sub, 12, 66);

  // Render mini dynamic chart line
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(12, 130);
  ctx.lineTo(60, 110);
  ctx.lineTo(110, 125);
  ctx.lineTo(160, 85);
  ctx.lineTo(210, 100);
  ctx.lineTo(244, 70);
  ctx.stroke();

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let y = 80; y <= 140; y += 20) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(244, y);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

export function buildOfficeScene(isLiteMode = false): OfficeSceneHandles {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a); // Deep slate background
  scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

  const serverLeds: THREE.Mesh[] = [];
  const screenMaterials: THREE.MeshBasicMaterial[] = [];
  const zoneHitBoxes: THREE.Mesh[] = [];

  // ===================== 1. LIGHTING =====================
  // Ambient fill light
  const ambientLight = new THREE.AmbientLight(0xfff5ea, isLiteMode ? 1.4 : 1.1);
  scene.add(ambientLight);

  // Main directional light (simulating sunlight through panoramic back windows)
  const sunLight = new THREE.DirectionalLight(0xffeedd, isLiteMode ? 1.2 : 1.8);
  sunLight.position.set(-8, 16, -14);
  sunLight.castShadow = !isLiteMode;
  if (!isLiteMode) {
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.bias = -0.0008;
  }
  scene.add(sunLight);

  // Soft secondary warm fill light from front-top
  const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.6);
  fillLight.position.set(10, 12, 14);
  scene.add(fillLight);

  // Spotlights above key zones
  const commandSpot = new THREE.SpotLight(0xffffff, 2.2, 16, Math.PI * 0.28, 0.4, 1.2);
  commandSpot.position.set(0, 7.5, -1.2);
  commandSpot.target.position.set(0, 0.8, -1.2);
  scene.add(commandSpot);
  scene.add(commandSpot.target);

  const meetingSpot = new THREE.SpotLight(0xffedd5, 1.8, 14, Math.PI * 0.32, 0.5, 1.2);
  meetingSpot.position.set(0, 7.5, 4.8);
  meetingSpot.target.position.set(0, 0.8, 4.8);
  scene.add(meetingSpot);
  scene.add(meetingSpot.target);

  // Cyan server glow light
  const serverGlow = new THREE.PointLight(0x06b6d4, 2.5, 9);
  serverGlow.position.set(1.8, 2.2, -6.2);
  scene.add(serverGlow);

  // ===================== 2. ROOM SHELL =====================
  const floorGeo = new THREE.PlaneGeometry(24, 18);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createFloorTexture(),
    roughness: 0.35,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = !isLiteMode;
  scene.add(floor);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(24, 18);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7.8;
  scene.add(ceiling);

  // Architectural ceiling LED strips
  for (let z = -6; z <= 6; z += 3) {
    const stripGeo = new THREE.BoxGeometry(20, 0.08, 0.25);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 7.74, z);
    scene.add(strip);
  }

  // Back Wall with huge windows (Z = -9)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x242e42, roughness: 0.7 });
  const backPillars = [-12, -7.5, -2.5, 2.5, 7.5, 12];
  for (let i = 0; i < backPillars.length; i++) {
    const pillarGeo = new THREE.BoxGeometry(0.7, 7.8, 0.6);
    const pillar = new THREE.Mesh(pillarGeo, wallMat);
    pillar.position.set(backPillars[i], 3.9, -8.8);
    pillar.castShadow = !isLiteMode;
    pillar.receiveShadow = !isLiteMode;
    scene.add(pillar);
  }

  // Lower back wall ledge
  const ledgeGeo = new THREE.BoxGeometry(24, 1.2, 0.6);
  const ledge = new THREE.Mesh(ledgeGeo, wallMat);
  ledge.position.set(0, 0.6, -8.8);
  scene.add(ledge);

  // Upper back wall header
  const headerGeo = new THREE.BoxGeometry(24, 1.2, 0.6);
  const header = new THREE.Mesh(headerGeo, wallMat);
  header.position.set(0, 7.2, -8.8);
  scene.add(header);

  // Window Glass
  const glassGeo = new THREE.PlaneGeometry(23.5, 5.4);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    transmission: 0.7,
    thickness: 0.5,
  });
  const windowGlass = new THREE.Mesh(glassGeo, glassMat);
  windowGlass.position.set(0, 3.9, -8.78);
  scene.add(windowGlass);

  // Skyline Backdrop Plane behind window
  const skylineGeo = new THREE.PlaneGeometry(36, 16);
  const skylineMat = new THREE.MeshBasicMaterial({ map: createSkylineTexture() });
  const skyline = new THREE.Mesh(skylineGeo, skylineMat);
  skyline.position.set(0, 7, -13.5);
  scene.add(skyline);

  // Left & Right Walls
  const sideWallGeo = new THREE.PlaneGeometry(18, 7.8);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-12, 3.9, 0);
  leftWall.receiveShadow = !isLiteMode;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(12, 3.9, 0);
  rightWall.receiveShadow = !isLiteMode;
  scene.add(rightWall);

  // Front Wall border with entrance portal
  const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7.8, 0.4), wallMat);
  frontWallL.position.set(-7, 3.9, 9);
  scene.add(frontWallL);

  const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7.8, 0.4), wallMat);
  frontWallR.position.set(7, 3.9, 9);
  scene.add(frontWallR);

  // Brand Sign above front entrance
  const signGeo = new THREE.PlaneGeometry(6.4, 1.6);
  const signMat = new THREE.MeshBasicMaterial({ map: createBrandSignTexture() });
  const brandSign = new THREE.Mesh(signGeo, signMat);
  brandSign.rotation.y = Math.PI;
  brandSign.position.set(0, 6.2, 8.78);
  scene.add(brandSign);

  // ===================== 3. FURNITURE BUILDERS =====================
  const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x222a38, roughness: 0.3, metalness: 0.2 });
  const woodDeskMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 });
  const metalLegMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.2 });
  const screenCasingMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
  const keyboardMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });

  function createDesk(x: number, z: number, rotY = 0, isExecutive = false): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    const width = isExecutive ? 3.4 : 2.4;
    const depth = isExecutive ? 1.4 : 1.1;

    // Tabletop
    const topGeo = new THREE.BoxGeometry(width, 0.08, depth);
    const topMesh = new THREE.Mesh(topGeo, isExecutive ? woodDeskMat : deskTopMat);
    topMesh.position.y = 0.74;
    topMesh.castShadow = !isLiteMode;
    topMesh.receiveShadow = !isLiteMode;
    group.add(topMesh);

    // Chrome/Steel legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.74, 12);
    const offsets = [
      [-width / 2 + 0.15, -depth / 2 + 0.12],
      [width / 2 - 0.15, -depth / 2 + 0.12],
      [-width / 2 + 0.15, depth / 2 - 0.12],
      [width / 2 - 0.15, depth / 2 - 0.12],
    ];
    for (const [lx, lz] of offsets) {
      const leg = new THREE.Mesh(legGeo, metalLegMat);
      leg.position.set(lx, 0.37, lz);
      leg.castShadow = !isLiteMode;
      group.add(leg);
    }

    // Keyboard & mouse pad
    const padGeo = new THREE.BoxGeometry(0.8, 0.01, 0.35);
    const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }));
    pad.position.set(0, 0.785, 0.15);
    group.add(pad);

    const kbGeo = new THREE.BoxGeometry(0.48, 0.015, 0.18);
    const kb = new THREE.Mesh(kbGeo, keyboardMat);
    kb.position.set(-0.06, 0.795, 0.15);
    group.add(kb);

    const mouseGeo = new THREE.BoxGeometry(0.08, 0.02, 0.12);
    const mouse = new THREE.Mesh(mouseGeo, keyboardMat);
    mouse.position.set(0.24, 0.795, 0.15);
    group.add(mouse);

    // Modern swivel office chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, 0.65);

    // Seat cushion
    const seatGeo = new THREE.BoxGeometry(0.55, 0.08, 0.52);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.y = 0.48;
    chairGroup.add(seat);

    // Backrest
    const backGeo = new THREE.BoxGeometry(0.52, 0.65, 0.06);
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.84, 0.23);
    chairGroup.add(back);

    // Chrome base & cylinder
    const basePole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.48, 12), metalLegMat);
    basePole.position.y = 0.24;
    chairGroup.add(basePole);

    for (let a = 0; a < 5; a++) {
      const angle = (a * Math.PI * 2) / 5;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.3), metalLegMat);
      arm.rotation.y = angle;
      arm.position.set(Math.sin(angle) * 0.15, 0.05, Math.cos(angle) * 0.15);
      chairGroup.add(arm);
    }
    group.add(chairGroup);

    return group;
  }

  // ===================== 4. MONITORS WITH DYNAMIC TEXTURES =====================
  function addMonitor(
    deskGroup: THREE.Group,
    posX: number,
    posZ: number,
    rotY = 0,
    width = 0.9,
    height = 0.52,
    title = "AGENT CONSOLE",
    sub = "READY",
    color = "#38bdf8"
  ) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.24, 12), metalLegMat);
    stand.position.set(posX, 0.78 + 0.12, posZ);
    deskGroup.add(stand);

    const frameGeo = new THREE.BoxGeometry(width, height, 0.04);
    const frame = new THREE.Mesh(frameGeo, screenCasingMat);
    frame.position.set(posX, 0.78 + 0.24 + height / 2, posZ);
    frame.rotation.y = rotY;
    deskGroup.add(frame);

    const screenTex = createScreenTexture(title, sub, color);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    screenMaterials.push(screenMat);

    const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.96, height * 0.92), screenMat);
    screenPlane.position.set(0, 0, 0.022);
    frame.add(screenPlane);
  }

  // Build each agent's desk based on AGENT_CONFIGS
  Object.values(AGENT_CONFIGS).forEach((cfg) => {
    const [dx, , dz] = cfg.deskPos;
    const isOrchestrator = cfg.id === "orchestrator";
    const desk = createDesk(dx, dz, cfg.deskRotY, isOrchestrator);
    scene.add(desk);

    if (isOrchestrator) {
      // Curved multi-screen setup for central commander
      addMonitor(desk, 0, -0.28, 0, 1.4, 0.65, "ORCHESTRATOR HUB", "SYSTEM: OPTIMAL", cfg.color);
      addMonitor(desk, -0.85, -0.15, Math.PI * 0.18, 0.75, 0.5, "TASK PIPELINE", "ALL WORKFLOWS ACTIVE", "#ec4899");
      addMonitor(desk, 0.85, -0.15, -Math.PI * 0.18, 0.75, 0.5, "SECURITY MATRIX", "GATEWAYS HEALTHY", "#38bdf8");
    } else {
      // Dual monitors for departmental stations
      addMonitor(desk, -0.42, -0.18, Math.PI * 0.08, 0.75, 0.48, `${cfg.nameUz.toUpperCase()}`, "MONITORING ACTIVE", cfg.color);
      addMonitor(desk, 0.42, -0.18, -Math.PI * 0.08, 0.75, 0.48, "LIVE TELEMETRY", "HEALTH: 100%", "#10b981");
    }

    // Interactive hitbox for clicking on desk
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(isOrchestrator ? 3.6 : 2.6, 2.2, isOrchestrator ? 2.4 : 2.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(dx, 1.1, dz);
    hitBox.userData = { agentId: cfg.id, type: "agent_desk" };
    scene.add(hitBox);
    zoneHitBoxes.push(hitBox);
  });

  // ===================== 5. SERVER ROOM (Z = -5.8, X = 1.8 to 4.5) =====================
  // Glass partition enclosure
  const serverGlassGeo = new THREE.BoxGeometry(4.2, 5.0, 0.08);
  const serverGlass = new THREE.Mesh(serverGlassGeo, glassMat);
  serverGlass.position.set(2.8, 2.5, -4.2);
  scene.add(serverGlass);

  // 2 Server Racks with glowing LEDs
  for (let r = 0; r < 2; r++) {
    const rackX = 1.8 + r * 1.5;
    const rackZ = -6.8;

    const rackFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 4.2, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 })
    );
    rackFrame.position.set(rackX, 2.1, rackZ);
    rackFrame.castShadow = !isLiteMode;
    scene.add(rackFrame);

    // Rows of glowing server units with LEDs
    for (let u = 0; u < 8; u++) {
      const unitY = 0.6 + u * 0.45;
      const unitMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.98, 0.36, 0.95),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
      );
      unitMesh.position.set(rackX, unitY, rackZ);
      scene.add(unitMesh);

      // Blinking status LEDs on front
      for (let l = 0; l < 6; l++) {
        const ledGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
        const ledColor = l % 3 === 0 ? 0x10b981 : l % 3 === 1 ? 0x06b6d4 : 0xf59e0b;
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(rackX - 0.35 + l * 0.14, unitY, rackZ + 0.49);
        scene.add(led);
        serverLeds.push(led);
      }
    }
  }

  // ===================== 6. MEETING & COLLABORATION LOUNGE (Z = 4.8) =====================
  // Big round boardroom table
  const tableGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.1, 32);
  const tableMesh = new THREE.Mesh(tableGeo, woodDeskMat);
  tableMesh.position.set(0, 0.74, 4.8);
  tableMesh.castShadow = !isLiteMode;
  scene.add(tableMesh);

  // Heavy central steel base
  const baseGeo = new THREE.CylinderGeometry(0.4, 0.7, 0.74, 24);
  const baseMesh = new THREE.Mesh(baseGeo, metalLegMat);
  baseMesh.position.set(0, 0.37, 4.8);
  scene.add(baseMesh);

  // 6 Conference Chairs around table
  for (let c = 0; c < 6; c++) {
    const angle = (c * Math.PI * 2) / 6;
    const cx = Math.sin(angle) * 3.1;
    const cz = 4.8 + Math.cos(angle) * 3.1;

    const chairGroup = new THREE.Group();
    chairGroup.position.set(cx, 0, cz);
    chairGroup.rotation.y = angle + Math.PI;

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.08, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    seat.position.y = 0.46;
    chairGroup.add(seat);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.5, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    );
    back.position.set(0, 0.74, 0.22);
    chairGroup.add(back);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 12), metalLegMat);
    pole.position.y = 0.23;
    chairGroup.add(pole);

    scene.add(chairGroup);
  }

  // Large Presentation Screen on lateral wall (Z = 4.8, X = -11.8)
  const presScreenGeo = new THREE.BoxGeometry(0.08, 2.4, 4.4);
  const presScreen = new THREE.Mesh(presScreenGeo, screenCasingMat);
  presScreen.position.set(-11.8, 3.8, 4.8);
  scene.add(presScreen);

  const presCanvas = document.createElement("canvas");
  presCanvas.width = 512;
  presCanvas.height = 280;
  const pctx = presCanvas.getContext("2d")!;
  pctx.fillStyle = "#0f172a";
  pctx.fillRect(0, 0, 512, 280);
  pctx.fillStyle = "#ffffff";
  pctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
  pctx.fillText("GULI AI · WORKFLOW STRATEGY", 24, 42);
  pctx.fillStyle = "#f43f5e";
  pctx.font = "14px monospace";
  pctx.fillText("PIPELINE: SALES → ORDER → PAYMENT → DISPATCH", 24, 76);

  // Diagrams on presentation screen
  pctx.strokeStyle = "#38bdf8";
  pctx.lineWidth = 3;
  pctx.strokeRect(30, 110, 100, 60);
  pctx.strokeRect(170, 110, 100, 60);
  pctx.strokeRect(310, 110, 100, 60);
  pctx.fillStyle = "#e2e8f0";
  pctx.font = "12px sans-serif";
  pctx.fillText("Orchestrator", 42, 145);
  pctx.fillText("Order Flow", 185, 145);
  pctx.fillText("Payment Check", 318, 145);

  const presMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(presCanvas) });
  const presPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.3), presMat);
  presPlane.rotation.y = Math.PI / 2;
  presPlane.position.set(0.045, 0, 0);
  presScreen.add(presPlane);

  // ===================== 7. DECORATIVE ELEMENTS =====================
  // Luxury potted ficus & monstera plants
  function createPottedPlant(px: number, pz: number, scale = 1.0) {
    const plantGroup = new THREE.Group();
    plantGroup.position.set(px, 0, pz);
    plantGroup.scale.set(scale, scale, scale);

    // Ceramic pot
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.7, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    pot.position.y = 0.35;
    pot.castShadow = !isLiteMode;
    plantGroup.add(pot);

    // Lush green leaves (stylized geometric foliage)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    for (let l = 0; l < 10; l++) {
      const leafAngle = (l * Math.PI * 2) / 10;
      const leafGeo = new THREE.SphereGeometry(0.24, 7, 7);
      leafGeo.scale(1.2, 0.4, 2.2);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(leafAngle) * 0.25, 0.8 + Math.random() * 0.6, Math.cos(leafAngle) * 0.25);
      leaf.rotation.set(Math.PI * 0.35, leafAngle, 0);
      leaf.castShadow = !isLiteMode;
      plantGroup.add(leaf);
    }
    scene.add(plantGroup);
  }

  createPottedPlant(-10.8, -7.2, 1.3);
  createPottedPlant(10.8, -7.2, 1.3);
  createPottedPlant(-10.8, 7.5, 1.2);
  createPottedPlant(10.8, 7.5, 1.2);
  createPottedPlant(-2.8, -7.2, 1.0);

  // Coffee & water bar station
  const barMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.95, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
  );
  barMesh.position.set(10.5, 0.475, 5.2);
  scene.add(barMesh);

  // Water cooler dispenser
  const coolerMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16),
    new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6, roughness: 0.1 })
  );
  coolerMesh.position.set(10.5, 1.3, 5.2);
  scene.add(coolerMesh);

  // Bookshelf / cabinet against right wall
  const shelfMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 3.2, 3.0),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
  );
  shelfMesh.position.set(11.7, 1.6, 0);
  scene.add(shelfMesh);

  // ===================== 8. UPDATE LOOP =====================
  let lastLedToggle = 0;
  const update = (_delta: number, elapsed: number) => {
    // Random blinking server LEDs
    if (elapsed - lastLedToggle > 0.12) {
      lastLedToggle = elapsed;
      for (let i = 0; i < serverLeds.length; i++) {
        if (Math.random() > 0.65) {
          const mat = serverLeds[i].material as THREE.MeshBasicMaterial;
          mat.color.setHex(Math.random() > 0.4 ? (Math.random() > 0.3 ? 0x10b981 : 0x06b6d4) : 0xf59e0b);
        }
      }
    }
  };

  return {
    scene,
    update,
    serverLeds,
    screenMaterials,
    zoneHitBoxes,
  };
}
