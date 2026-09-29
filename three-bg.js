/* StudyVerse 9
   Lightweight interactive 3D background
*/

import * as THREE from
  "https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js";

const canvas = document.querySelector("#three-bg");

if (!canvas) {
  console.warn("StudyVerse 9: #three-bg not found.");
} else {

  let scene;
  let camera;
  let renderer;

  try {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    camera.position.z = 8;

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.8)
    );

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    /*
      Main group
    */

    const world = new THREE.Group();

    scene.add(world);

    /*
      Central 9
    */

    const nineGroup = new THREE.Group();

    const ringGeometry =
      new THREE.TorusGeometry(
        1.15,
        0.16,
        24,
        96
      );

    const ringMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x6c63ff,
        transparent: true,
        opacity: 0.9
      });

    const ring =
      new THREE.Mesh(
        ringGeometry,
        ringMaterial
      );

    nineGroup.add(ring);

    /*
      Vertical stroke of the 9
    */

    const stemGeometry =
      new THREE.CylinderGeometry(
        0.16,
        0.16,
        1.5,
        24
      );

    const stemMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x8f7cff,
        transparent: true,
        opacity: 0.9
      });

    const stem =
      new THREE.Mesh(
        stemGeometry,
        stemMaterial
      );

    stem.position.set(
      0.85,
      -0.75,
      0
    );

    nineGroup.add(stem);

    world.add(nineGroup);

    /*
      Floating mathematical objects
    */

    const shapes = [];

    const geometries = [
      new THREE.IcosahedronGeometry(0.35, 1),
      new THREE.OctahedronGeometry(0.3),
      new THREE.TetrahedronGeometry(0.32),
      new THREE.TorusGeometry(0.28, 0.08, 12, 32)
    ];

    for (let i = 0; i < 22; i++) {

      const geometry =
        geometries[i % geometries.length];

      const material =
        new THREE.MeshBasicMaterial({
          color:
            i % 2 === 0
              ? 0x5b8cff
              : 0xb36cff,
          wireframe: true,
          transparent: true,
          opacity: 0.35
        });

      const mesh =
        new THREE.Mesh(
          geometry,
          material
        );

      mesh.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 5
      );

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      mesh.userData.speed =
        0.1 + Math.random() * 0.3;

      shapes.push(mesh);

      world.add(mesh);
    }

    /*
      Particle field
    */

    const particleCount = 500;

    const positions =
      new Float32Array(
        particleCount * 3
      );

    for (let i = 0; i < particleCount; i++) {

      positions[i * 3] =
        (Math.random() - 0.5) * 18;

      positions[i * 3 + 1] =
        (Math.random() - 0.5) * 12;

      positions[i * 3 + 2] =
        (Math.random() - 0.5) * 10;
    }

    const particleGeometry =
      new THREE.BufferGeometry();

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions,
        3
      )
    );

    const particleMaterial =
      new THREE.PointsMaterial({
        color: 0x8b82ff,
        size: 0.025,
        transparent: true,
        opacity: 0.65
      });

    const particles =
      new THREE.Points(
        particleGeometry,
        particleMaterial
      );

    world.add(particles);

    /*
      Mouse interaction
    */

    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener(
      "pointermove",
      event => {

        mouseX =
          (event.clientX /
            window.innerWidth -
            0.5);

        mouseY =
          (event.clientY /
            window.innerHeight -
            0.5);

      },
      { passive: true }
    );

    /*
      Animation
    */

    renderer.setAnimationLoop(
      time => {

        const t = time * 0.001;

        nineGroup.rotation.y =
          Math.sin(t * 0.5) * 0.25;

        nineGroup.rotation.x =
          Math.cos(t * 0.4) * 0.08;

        shapes.forEach(
          (shape, index) => {

            shape.rotation.x +=
              shape.userData.speed *
              0.01;

            shape.rotation.y +=
              shape.userData.speed *
              0.008;

            shape.position.y +=
              Math.sin(
                t * 0.5 +
                index
              ) * 0.0005;
          }
        );

        particles.rotation.y =
          t * 0.015;

        /*
          Smooth camera parallax
        */

        camera.position.x +=
          (mouseX * 0.7 -
            camera.position.x) * 0.025;

        camera.position.y +=
          (-mouseY * 0.5 -
            camera.position.y) * 0.025;

        camera.lookAt(0, 0, 0);

        renderer.render(
          scene,
          camera
        );
      }
    );

    /*
      Responsive resize
    */

    window.addEventListener(
      "resize",
      () => {

        camera.aspect =
          window.innerWidth /
          window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        );

      }
    );

  } catch (error) {

    console.error(
      "StudyVerse 9 3D initialization failed:",
      error
    );

    canvas.style.display = "none";
  }
}
