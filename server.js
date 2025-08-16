// server.js
// A simple Node.js server using Express to handle Photoroom API requests and further image processing with sharp.

// --- Dependencies ---
const express = require('express');
const multer = require('multer'); // Middleware for handling multipart/form-data (file uploads)
const fetch = require('node-fetch'); // Used to make HTTP requests to the Photoroom API
const FormData = require('form-data'); // Required to construct the form data for the Photoroom API
const cors = require('cors'); // Middleware to enable Cross-Origin Resource Sharing
const sharp = require('sharp'); // High-performance image processing library

// --- Initialization ---
const app = express();
const port = 3000; // The port the server will run on

// --- Environment Variables ---
// IMPORTANT: Store your API key in an environment variable for security.
// To run this server, you'll use a command like:
// PHOTOROOM_API_KEY=your_actual_api_key_here node server.js
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

// --- Middleware Setup ---
app.use(cors());
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- API Endpoints ---

/**
 * @route POST /process-image
 * @description First step: Receives an image, removes the background via Photoroom,
 * and does an initial resize to 1200x1300.
 */
app.post('/process-image', upload.single('image_file'), async (req, res) => {
    console.log('Received request for initial processing.');

    if (!PHOTOROOM_API_KEY) {
        console.error('API key is not configured.');
        return res.status(500).json({ error: 'Server configuration error: API key is missing.' });
    }
    if (!req.file) {
        console.warn('No image file was uploaded.');
        return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
        const formData = new FormData();
        formData.append('image_file', req.file.buffer, { filename: req.file.originalname });

        console.log('Forwarding image to Photoroom API for background removal...');
        const response = await fetch('https://sdk.photoroom.com/v1/segment', {
            method: 'POST',
            headers: { ...formData.getHeaders(), 'X-Api-Key': PHOTOROOM_API_KEY },
                                     body: formData,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Photoroom API Error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Photoroom API responded with status: ${response.status}`);
        }

        const imageBuffer = await response.buffer();
        console.log('Background removed. Resizing image to 1200x1300...');

        const resizedImageBuffer = await sharp(imageBuffer)
        .resize(1200, 1300)
        .png()
        .toBuffer();

        console.log('Initial processing complete.');
        res.setHeader('Content-Type', 'image/png');
        res.send(resizedImageBuffer);

    } catch (error) {
        console.error('An error occurred during initial processing:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

/**
 * @route POST /add-corner-pixels
 * @description Final step: Receives an image (potentially edited by the user)
 * and adds white pixels to the corners.
 */
app.post('/add-corner-pixels', upload.single('image_file'), async (req, res) => {
    console.log('Received request to add corner pixels.');

    if (!req.file) {
        console.warn('No image file was uploaded for final processing.');
        return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
        const imageBuffer = req.file.buffer;
        const { width, height } = await sharp(imageBuffer).metadata();

        console.log(`Adding pixels to image of size ${width}x${height}`);

        const finalImageBuffer = await sharp(imageBuffer)
        .composite([
            { input: Buffer.from([255, 255, 255, 255]), raw: { width: 1, height: 1, channels: 4 }, gravity: 'northwest' },
                   { input: Buffer.from([255, 255, 255, 255]), raw: { width: 1, height: 1, channels: 4 }, gravity: 'northeast' },
                   { input: Buffer.from([255, 255, 255, 255]), raw: { width: 1, height: 1, channels: 4 }, gravity: 'southwest' },
                   { input: Buffer.from([255, 255, 255, 255]), raw: { width: 1, height: 1, channels: 4 }, gravity: 'southeast' },
        ])
        .png()
        .toBuffer();

        console.log('Final processing complete.');
        res.setHeader('Content-Type', 'image/png');
        res.send(finalImageBuffer);

    } catch (error) {
        console.error('An error occurred during final processing:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`✅ Server is running at http://localhost:${port}`);
    console.log('Waiting for image processing requests...');
});
