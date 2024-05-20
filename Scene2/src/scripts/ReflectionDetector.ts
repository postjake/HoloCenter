import * as THREE from 'three';

interface BrightPoint {
    x: number;
    y: number;
    brightness: number;
    color: THREE.Color;
}

class ReflectionDetector {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private particleSystem: THREE.Points;
    private particles: THREE.BufferGeometry;
    private particleMaterial: THREE.PointsMaterial;
    private webcamVideo: HTMLVideoElement;
    private brightnessThreshold: number = 200;
    private edgeThreshold: number = 0.2;
    private projectionDistance: number = 0.1;
    private maxBrightPoints: number = 5;

    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;

        this.webcamVideo = document.createElement('video');
        this.initWebcam();
        this.particleSystem = new THREE.Points;

        this.particles = new THREE.BufferGeometry();
        this.initParticleSystem();

        this.particleMaterial = new THREE.PointsMaterial;
        
    }

    private initWebcam() {
        this.webcamVideo.autoplay = true;

        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                this.webcamVideo.srcObject = stream;
                this.webcamVideo.play();
                requestAnimationFrame(this.detectReflections.bind(this));
            })
            .catch((err) => {
                console.error("Webcam initialization failed: ", err);
            });
    }

    private initParticleSystem() {
        const particleCount = this.maxBrightPoints;
        const positions = new Float32Array(particleCount * 3);
        this.particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.particleMaterial = new THREE.PointsMaterial({ size: 0.1, vertexColors: true });
        this.particleSystem = new THREE.Points(this.particles, this.particleMaterial);

        this.scene.add(this.particleSystem);
    }

    private detectReflections() {
        if (this.webcamVideo.readyState === this.webcamVideo.HAVE_ENOUGH_DATA) {
            const width = this.webcamVideo.videoWidth;
            const height = this.webcamVideo.videoHeight;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }

            ctx.drawImage(this.webcamVideo, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const pixels = imageData.data;
            const brightPoints = this.findBrightPoints(pixels, width, height);

            this.updateParticleSystem(brightPoints);
        }

        requestAnimationFrame(this.detectReflections.bind(this));
    }

    private findBrightPoints(pixels: Uint8ClampedArray, width: number, height: number): BrightPoint[] {
        const brightPoints: BrightPoint[] = [];
        const edges = this.applySobelFilter(pixels, width, height);

        for (let i = 0; i < pixels.length; i += 4) {
            const brightness = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);

            if (brightness > this.brightnessThreshold && edges[x][y] > this.edgeThreshold) {
                brightPoints.push({ x, y, brightness, color: new THREE.Color(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255) });
            }
        }

        return brightPoints;
    }

    private updateParticleSystem(brightPoints: BrightPoint[]) {
        brightPoints.sort((a, b) => b.brightness - a.brightness);
        if (brightPoints.length > this.maxBrightPoints) {
            brightPoints.length = this.maxBrightPoints;
        }

        const positions = this.particles.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < brightPoints.length; i++) {
            const { x, y, color } = brightPoints[i];
            const worldPos = this.convertToWorldPosition(x, y, this.webcamVideo.videoWidth, this.webcamVideo.videoHeight);
            positions.setXYZ(i, worldPos.x, worldPos.y, worldPos.z - this.projectionDistance);
            // Setting color is not directly handled here, ensure your pointsMaterial handles colors
        }
        positions.needsUpdate = true;
    }

    private applySobelFilter(pixels: Uint8ClampedArray, width: number, height: number): number[][] {
        const gradients: number[][] = [];
        const gx = [
            [-1, 0, 1],
            [-2, 0, 2],
            [-1, 0, 1]
        ];
        const gy = [
            [-1, -2, -1],
            [0, 0, 0],
            [1, 2, 1]
        ];

        for (let y = 0; y < height; y++) {
            gradients[y] = [];
            for (let x = 0; x < width; x++) {
                gradients[y][x] = 0;
            }
        }

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sumX = 0;
                let sumY = 0;

                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const pixelIndex = ((y + i) * width + (x + j)) * 4;
                        const brightness = 0.299 * pixels[pixelIndex] + 0.587 * pixels[pixelIndex + 1] + 0.114 * pixels[pixelIndex + 2];
                        sumX += brightness * gx[i + 1][j + 1];
                        sumY += brightness * gy[i + 1][j + 1];
                    }
                }

                gradients[y][x] = Math.sqrt(sumX * sumX + sumY * sumY);
            }
        }

        return gradients;
    }

    private convertToWorldPosition(x: number, y: number, width: number, height: number): THREE.Vector3 {
        const normalizedX = x / width * 2 - 1;
        const normalizedY = -y / height * 2 + 1;
        return new THREE.Vector3(normalizedX, normalizedY, 0);
    }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize renderer, scene, and camera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const reflectionDetector = new ReflectionDetector();

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    reflectionDetector.render();
}
animate();
