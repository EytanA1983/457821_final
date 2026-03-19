/**
 * Image Optimization Script
 *
 * Optimizes images in public/ directory using Sharp.
 * Supports: JPG, PNG, WebP, AVIF
 *
 * Usage:
 *   node scripts/optimize-images.js [source-dir] [output-dir]
 *
 * Example:
 *   node scripts/optimize-images.js ./public ./public
 */

import sharp from 'sharp';
import { readdir, stat, mkdir, writeFile } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { existsSync } from 'fs';

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const MAX_WIDTH = 1920; // Max width for images
const QUALITY = {
  jpeg: 85,
  png: 90,
  webp: 85,
  avif: 50, // AVIF is very efficient, lower quality is fine
};

/**
 * Check if file is an image
 */
function isImageFile(filename) {
  const ext = extname(filename).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Get optimization options based on format
 */
function getOptimizationOptions(format) {
  const ext = format.toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') {
    return {
      format: 'jpeg',
      mozjpeg: true, // Better compression
      quality: QUALITY.jpeg,
      progressive: true, // Progressive JPEG
    };
  }

  if (ext === '.png') {
    return {
      format: 'png',
      pngquant: true, // Better compression
      quality: QUALITY.png,
      compressionLevel: 9,
    };
  }

  if (ext === '.webp') {
    return {
      format: 'webp',
      quality: QUALITY.webp,
      effort: 6, // 0-6, higher = better compression but slower
    };
  }

  if (ext === '.avif') {
    return {
      format: 'avif',
      quality: QUALITY.avif,
      effort: 4, // 0-9, higher = better compression but slower
    };
  }

  return null;
}

/**
 * Optimize a single image
 */
async function optimizeImage(inputPath, outputPath) {
  try {
    const stats = await stat(inputPath);
    const originalSize = stats.size;

    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    const format = extname(inputPath).toLowerCase();

    // Resize if too large
    let sharpInstance = sharp(inputPath);
    if (metadata.width > MAX_WIDTH) {
      sharpInstance = sharpInstance.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // Get optimization options
    const options = getOptimizationOptions(format);
    if (!options) {
      console.warn(`⚠️  Unsupported format: ${format} - skipping ${inputPath}`);
      return { optimized: false, saved: 0 };
    }

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Optimize image. Sharp cannot read/write the same file path via toFile,
    // so in in-place mode we render to a buffer and overwrite.
    const isInPlace = inputPath === outputPath;
    if (isInPlace) {
      const optimizedBuffer = await sharpInstance
        .toFormat(options.format, options)
        .toBuffer();
      await writeFile(outputPath, optimizedBuffer);
    } else {
      await sharpInstance
        .toFormat(options.format, options)
        .toFile(outputPath);
    }

    // Get optimized size
    const optimizedStats = await stat(outputPath);
    const optimizedSize = optimizedStats.size;
    const saved = originalSize - optimizedSize;
    const savedPercent = ((saved / originalSize) * 100).toFixed(1);

    return {
      optimized: true,
      originalSize,
      optimizedSize,
      saved,
      savedPercent,
      format: options.format,
    };
  } catch (error) {
    console.error(`❌ Error optimizing ${inputPath}:`, error.message);
    return { optimized: false, error: error.message };
  }
}

/**
 * Recursively process directory
 */
async function processDirectory(sourceDir, outputDir, basePath = '') {
  const entries = await readdir(join(sourceDir, basePath), { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const sourcePath = join(sourceDir, basePath, entry.name);
    const relativePath = join(basePath, entry.name);
    const outputPath = join(outputDir, relativePath);

    if (entry.isDirectory()) {
      // Recursively process subdirectories
      const subResults = await processDirectory(sourceDir, outputDir, relativePath);
      results.push(...subResults);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      // Optimize image
      console.log(`🖼️  Optimizing: ${relativePath}`);
      const result = await optimizeImage(sourcePath, outputPath);
      results.push({
        path: relativePath,
        ...result,
      });

      if (result.optimized) {
        const sizeMB = (result.originalSize / 1024 / 1024).toFixed(2);
        const optimizedMB = (result.optimizedSize / 1024 / 1024).toFixed(2);
        console.log(`   ✅ ${sizeMB}MB → ${optimizedMB}MB (saved ${result.savedPercent}%)`);
      }
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const sourceDir = args[0] || './public';
  const outputDir = args[1] || sourceDir; // Default: optimize in place

  console.log('🚀 Starting image optimization...');
  console.log(`📁 Source: ${sourceDir}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log('');

  if (!existsSync(sourceDir)) {
    console.warn(`⚠️  Source directory does not exist: ${sourceDir}`);
    console.log('   Skipping image optimization...');
    return;
  }

  const startTime = Date.now();
  const results = await processDirectory(sourceDir, outputDir);
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Summary
  console.log('');
  console.log('📊 Summary:');
  const optimized = results.filter(r => r.optimized);
  const failed = results.filter(r => !r.optimized && r.error);
  const skipped = results.filter(r => !r.optimized && !r.error);

  if (optimized.length > 0) {
    const totalOriginal = optimized.reduce((sum, r) => sum + r.originalSize, 0);
    const totalOptimized = optimized.reduce((sum, r) => sum + r.optimizedSize, 0);
    const totalSaved = totalOriginal - totalOptimized;
    const totalSavedPercent = ((totalSaved / totalOriginal) * 100).toFixed(1);
    const totalOriginalMB = (totalOriginal / 1024 / 1024).toFixed(2);
    const totalOptimizedMB = (totalOptimized / 1024 / 1024).toFixed(2);
    const totalSavedMB = (totalSaved / 1024 / 1024).toFixed(2);

    console.log(`   ✅ Optimized: ${optimized.length} images`);
    console.log(`   📦 Size: ${totalOriginalMB}MB → ${totalOptimizedMB}MB`);
    console.log(`   💾 Saved: ${totalSavedMB}MB (${totalSavedPercent}%)`);
  }

  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.length} images`);
  }

  if (skipped.length > 0) {
    console.log(`   ⏭️  Skipped: ${skipped.length} files`);
  }

  console.log(`   ⏱️  Duration: ${duration}s`);
  console.log('');
  console.log('✨ Image optimization complete!');

  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run if called directly
// In ES modules, we check if this file is the main module
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('optimize-images.js') ||
   process.argv[1].includes('optimize-images'));

if (isMainModule) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { optimizeImage, processDirectory };
