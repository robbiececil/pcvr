<!DOCTYPE html>
<html lang="en">

<head>
   <title>three.js vr - interactive pointcloud</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <link type="text/css" rel="stylesheet" href="main.css">
</head>

<body>
    
   
    <script type="module">
  
	      import * as THREE from "three";

	      //
	      //vr balls imports

	      import { BoxGeometry } from "three/src/geometries/BoxGeometry";
	      import { VRButton } from "three/examples/jsm/webxr/VRButton";
	      import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory";

	      import Stats from "three/examples/jsm/libs/stats.module";

	      import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
	      import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";

	      var renderer, scene, camera, stats;
	      var pointclouds;
	      var raycaster;
	      var mouse = new THREE.Vector2();
	      var intersection = null;
	      var spheres = [];
	      var spheresIndex = 0;
	      var clock;

	      var threshold = 0.1;
	      var pointSize = 0.05;
	      var width = 80;
	      var length = 160;
	      var rotateY = new THREE.Matrix4().makeRotationY(0.005);

	      init();
	      animate();

	      function generatePointCloudGeometry(color, width, length) {
		var geometry = new THREE.BufferGeometry();
		var numPoints = width * length;

		var positions = new Float32Array(numPoints * 3);
		var colors = new Float32Array(numPoints * 3);

		var k = 0;

		for (var i = 0; i < width; i++) {
		  for (var j = 0; j < length; j++) {
		    var u = i / width;
		    var v = j / length;
		    var x = u - 0.5;
		    var y = (Math.cos(u * Math.PI * 4) + Math.sin(v * Math.PI * 8)) / 20;
		    var z = v - 0.5;

		    positions[3 * k] = x;
		    positions[3 * k + 1] = y;
		    positions[3 * k + 2] = z;

		    var intensity = (y + 0.1) * 5;
		    colors[3 * k] = color.r * intensity;
		    colors[3 * k + 1] = color.g * intensity;
		    colors[3 * k + 2] = color.b * intensity;

		    k++;
		  }
		}

		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		geometry.computeBoundingBox();

		return geometry;
	      }

	      function generatePointcloud(color, width, length) {
		var geometry = generatePointCloudGeometry(color, width, length);
		var material = new THREE.PointsMaterial({
		  size: pointSize,
		  vertexColors: true
		});

		return new THREE.Points(geometry, material);
	      }

	      function generateIndexedPointcloud(color, width, length) {
		var geometry = generatePointCloudGeometry(color, width, length);
		var numPoints = width * length;
		var indices = new Uint16Array(numPoints);

		var k = 0;

		for (var i = 0; i < width; i++) {
		  for (var j = 0; j < length; j++) {
		    indices[k] = k;
		    k++;
		  }
		}

		geometry.setIndex(new THREE.BufferAttribute(indices, 1));

		var material = new THREE.PointsMaterial({
		  size: pointSize,
		  vertexColors: true
		});

		return new THREE.Points(geometry, material);
	      }

	      function generateIndexedWithOffsetPointcloud(color, width, length) {
		var geometry = generatePointCloudGeometry(color, width, length);
		var numPoints = width * length;
		var indices = new Uint16Array(numPoints);

		var k = 0;

		for (var i = 0; i < width; i++) {
		  for (var j = 0; j < length; j++) {
		    indices[k] = k;
		    k++;
		  }
		}

		geometry.setIndex(new THREE.BufferAttribute(indices, 1));
		geometry.addGroup(0, indices.length);

		var material = new THREE.PointsMaterial({
		  size: pointSize,
		  vertexColors: true
		});

		return new THREE.Points(geometry, material);
	      }

	      function init() {
		var container = document.getElementById("container");

		scene = new THREE.Scene();

		clock = new THREE.Clock();

		camera = new THREE.PerspectiveCamera(
		  45,
		  window.innerWidth / window.innerHeight,
		  1,
		  10000
		);
		camera.position.set(10, 10, 10);
		camera.lookAt(scene.position);
		camera.updateMatrix();

		//

		var pcBuffer = generatePointcloud(new THREE.Color(1, 0, 0), width, length);
		pcBuffer.scale.set(5, 10, 10);
		pcBuffer.position.set(-5, 0, 0);
		scene.add(pcBuffer);

		var pcIndexed = generateIndexedPointcloud(
		  new THREE.Color(0, 1, 0),
		  width,
		  length
		);
		pcIndexed.scale.set(5, 10, 10);
		pcIndexed.position.set(0, 0, 0);
		scene.add(pcIndexed);

		var pcIndexedOffset = generateIndexedWithOffsetPointcloud(
		  new THREE.Color(0, 1, 1),
		  width,
		  length
		);
		pcIndexedOffset.scale.set(5, 10, 10);
		pcIndexedOffset.position.set(5, 0, 0);
		scene.add(pcIndexedOffset);

		pointclouds = [pcBuffer, pcIndexed, pcIndexedOffset];

		//

		var sphereGeometry = new THREE.SphereBufferGeometry(0.1, 32, 32);
		var sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

		for (var i = 0; i < 40; i++) {
		  var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		  scene.add(sphere);
		  spheres.push(sphere);
		}

		//

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.xr.enabled = true;
		document.body.appendChild(renderer.domElement);

		document.body.appendChild(VRButton.createButton(renderer));

		//

		window.addEventListener("resize", onWindowResize, false);

		//

		if (typeof TESTING !== "undefined") {
		  for (var i = 0; i < 200; i++) {
		    render();
		  }
		}

		//

		raycaster = new THREE.Raycaster();
		raycaster.params.Points.threshold = threshold;

		//

		stats = new Stats();
		document.body.appendChild(stats.dom);

		//

		window.addEventListener("resize", onWindowResize, false);
		document.addEventListener("mousemove", onDocumentMouseMove, false);
	      }

	      function onDocumentMouseMove(event) {
		event.preventDefault();

		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	      }

	      function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	      }

	      function animate() {
		requestAnimationFrame(animate);

		render();
		stats.update();
	      }

	      var toggle = 0;

	      function render() {
		camera.applyMatrix4(rotateY);
		camera.updateMatrixWorld();

		raycaster.setFromCamera(mouse, camera);

		var intersections = raycaster.intersectObjects(pointclouds);
		intersection = intersections.length > 0 ? intersections[0] : null;

		if (toggle > 0.02 && intersection !== null) {
		  spheres[spheresIndex].position.copy(intersection.point);
		  spheres[spheresIndex].scale.set(1, 1, 1);
		  spheresIndex = (spheresIndex + 1) % spheres.length;

		  toggle = 0;
		}

		for (var i = 0; i < spheres.length; i++) {
		  var sphere = spheres[i];
		  sphere.scale.multiplyScalar(0.98);
		  sphere.scale.clampScalar(0.01, 1);
		}

		toggle += clock.getDelta();

		renderer.render(scene, camera);
	      }

    </script>
	</body>
</html>
