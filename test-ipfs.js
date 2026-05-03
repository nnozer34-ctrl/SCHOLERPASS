#!/usr/bin/env node

/**
 * IPFS Integration Test Script
 * Tests IPFS functionality and Pinata connectivity
 */

import fetch from "node:fetch";
import { readFileSync } from "node:fs";

const BASE_URL = process.env.API_URL || "http://localhost:4000";
const TEST_FILE = process.env.TEST_FILE || "./IPFS_GUIDE.md";

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

function log(color, ...args) {
    console.log(`${color}${args.join(" ")}${colors.reset}`);
}

function success(msg) {
    log(colors.green, "✓", msg);
}

function error(msg) {
    log(colors.red, "✗", msg);
}

function info(msg) {
    log(colors.cyan, "ℹ", msg);
}

function warn(msg) {
    log(colors.yellow, "⚠", msg);
}

async function testHealth() {
    info("Testing health endpoint...");
    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const data = await response.json();

        if (response.ok) {
            success(`Backend online (Port: ${BASE_URL.split(":")[2]})`);
            info(`IPFS Mode: ${data.ipfs?.mode || "unknown"}`);
            info(`Pinata Configured: ${data.ipfs?.configured || false}`);
            info(`Total Uploads: ${data.database?.uploads?.total || 0}`);
            info(`  - Real: ${data.database?.uploads?.real || 0}`);
            info(`  - Mock: ${data.database?.uploads?.mock || 0}`);
            info(`Total Achievements: ${data.database?.achievements || 0}`);
            return true;
        } else {
            error(`Health check failed: ${response.status}`);
            return false;
        }
    } catch (err) {
        error(`Backend not responding: ${err.message}`);
        return false;
    }
}

async function testFileUpload() {
    info("Testing file upload...");

    try {
        const fileContent = readFileSync(TEST_FILE);
        const filename = TEST_FILE.split("/").pop();

        info(`Uploading: ${filename} (${fileContent.length} bytes)`);

        const formData = new FormData();
        formData.append("file", new Blob([fileContent], { type: "text/markdown" }), filename);

        const response = await fetch(`${BASE_URL}/api/ipfs/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            success(`File uploaded successfully`);
            info(`CID: ${data.cid}`);
            info(`Gateway: ${data.gatewayUrl}`);
            info(`Mode: ${data.mocked ? "MOCK" : "REAL (Pinata)"}`);
            info(`Size: ${data.size} bytes`);
            return data.cid;
        } else {
            error(`Upload failed: ${data.error}`);
            return null;
        }
    } catch (err) {
        error(`Upload error: ${err.message}`);
        return null;
    }
}

async function testUploadsList() {
    info("Testing uploads list...");

    try {
        const response = await fetch(`${BASE_URL}/api/ipfs/uploads?limit=10`);
        const data = await response.json();

        if (response.ok) {
            success(`Fetched uploads list`);
            info(`Total uploads: ${data.pagination?.total || 0}`);

            if (data.uploads?.length > 0) {
                info("Latest uploads:");
                data.uploads.slice(0, 3).forEach((upload, idx) => {
                    info(`  ${idx + 1}. ${upload.filename} (${upload.size} bytes)`);
                    info(`     CID: ${upload.cid.slice(0, 20)}...`);
                });
            } else {
                warn("No uploads found");
            }
            return true;
        } else {
            error(`Failed to fetch uploads: ${data.error}`);
            return false;
        }
    } catch (err) {
        error(`Uploads list error: ${err.message}`);
        return false;
    }
}

async function testFileTypeValidation() {
    info("Testing file type validation...");

    try {
        const invalidContent = Buffer.from("fake executable");
        const formData = new FormData();
        formData.append(
            "file",
            new Blob([invalidContent], { type: "application/x-executable" }),
            "test.exe"
        );

        const response = await fetch(`${BASE_URL}/api/ipfs/upload`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            success(`File type validation working: ${data.error}`);
            return true;
        } else {
            warn(`File type validation may not be working properly`);
            return false;
        }
    } catch (err) {
        error(`Validation test error: ${err.message}`);
        return false;
    }
}

async function runTests() {
    console.log("\n");
    log(colors.bright + colors.cyan, "╔════════════════════════════════════════╗");
    log(colors.bright + colors.cyan, "║     IPFS Integration Test Suite         ║");
    log(colors.bright + colors.cyan, "╚════════════════════════════════════════╝");
    console.log();

    const tests = [
        { name: "Health Check", fn: testHealth },
        { name: "File Upload", fn: testFileUpload },
        { name: "Uploads List", fn: testUploadsList },
        { name: "File Type Validation", fn: testFileTypeValidation },
    ];

    const results = [];

    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, passed: !!result });
        } catch (err) {
            error(`Test "${test.name}" crashed: ${err.message}`);
            results.push({ name: test.name, passed: false });
        }
        console.log();
    }

    // Summary
    log(colors.bright + colors.cyan, "╔════════════════════════════════════════╗");
    log(colors.bright + colors.cyan, "║              Test Results               ║");
    log(colors.bright + colors.cyan, "╚════════════════════════════════════════╝");
    console.log();

    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    results.forEach((r) => {
        if (r.passed) {
            success(r.name);
        } else {
            error(r.name);
        }
    });

    console.log();
    if (passed === total) {
        log(colors.bright + colors.green, `All ${total} tests passed! ✓`);
    } else {
        log(colors.bright + colors.yellow, `${passed}/${total} tests passed`);
    }
    console.log();
}

// Run tests
runTests().catch((err) => {
    error(`Test suite failed: ${err.message}`);
    process.exit(1);
});
