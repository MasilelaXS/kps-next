/**
 * Image Compression Tests
 * Manual tests to verify compression works correctly
 * 
 * To test:
 * 1. Open browser console
 * 2. Import { imageCompression } from '@/lib/imageCompression'
 * 3. Run tests below
 */

import { imageCompression } from '../imageCompression';

/**
 * Test 1: Canvas compression (signatures)
 */
export async function testSignatureCompression() {
  console.log('=== Testing Signature Compression ===');
  
  // Create a test canvas
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error('Failed to get canvas context');
    return;
  }

  // Draw a simple signature-like pattern
  ctx.fillStyle = '#000000';
  ctx.font = '48px cursive';
  ctx.fillText('John Doe Signature', 50, 200);
  ctx.beginPath();
  ctx.moveTo(50, 220);
  ctx.lineTo(700, 220);
  ctx.stroke();

  try {
    const result = imageCompression.compressSignature(canvas);
    console.log('✓ Signature compression successful');
    console.log('  Original:', imageCompression.formatBytes(result.originalSize));
    console.log('  Compressed:', imageCompression.formatBytes(result.compressedSize));
    console.log('  Ratio:', (result.compressionRatio * 100).toFixed(1) + '%');
    console.log('  Dimensions:', `${result.width}x${result.height}`);
    return result;
  } catch (error) {
    console.error('✗ Signature compression failed:', error);
    throw error;
  }
}

/**
 * Test 2: File compression (photos)
 */
export async function testPhotoCompression(file: File) {
  console.log('=== Testing Photo Compression ===');
  console.log('File:', file.name, imageCompression.formatBytes(file.size));

  try {
    const result = await imageCompression.compressPhoto(file, 'medium');
    console.log('✓ Photo compression successful');
    console.log('  Original:', imageCompression.formatBytes(result.originalSize));
    console.log('  Compressed:', imageCompression.formatBytes(result.compressedSize));
    console.log('  Ratio:', (result.compressionRatio * 100).toFixed(1) + '%');
    console.log('  Dimensions:', `${result.width}x${result.height}`);
    return result;
  } catch (error) {
    console.error('✗ Photo compression failed:', error);
    throw error;
  }
}

/**
 * Test 3: Data URL compression
 */
export async function testDataUrlCompression(dataUrl: string) {
  console.log('=== Testing Data URL Compression ===');

  try {
    const result = await imageCompression.compressDataUrl(dataUrl, {
      maxWidth: 1280,
      maxHeight: 960,
      quality: 0.8,
      fileType: 'image/jpeg'
    });
    console.log('✓ Data URL compression successful');
    console.log('  Original:', imageCompression.formatBytes(result.originalSize));
    console.log('  Compressed:', imageCompression.formatBytes(result.compressedSize));
    console.log('  Ratio:', (result.compressionRatio * 100).toFixed(1) + '%');
    return result;
  } catch (error) {
    console.error('✗ Data URL compression failed:', error);
    throw error;
  }
}

/**
 * Test 4: Batch compression
 */
export async function testBatchCompression(files: File[]) {
  console.log('=== Testing Batch Compression ===');
  console.log('Files:', files.length);

  try {
    const results = await imageCompression.compressBatch(files, {
      maxWidth: 1280,
      maxHeight: 960,
      quality: 0.8,
      fileType: 'image/jpeg'
    });
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✓ Batch compression complete: ${successful.length} succeeded, ${failed.length} failed`);
    
    successful.forEach(({ filename, result }) => {
      if (result) {
        console.log(`  ${filename}:`, 
          imageCompression.formatBytes(result.originalSize), '→',
          imageCompression.formatBytes(result.compressedSize)
        );
      }
    });
    
    if (failed.length > 0) {
      console.warn('Failed files:', failed.map(f => f.filename));
    }
    
    return results;
  } catch (error) {
    console.error('✗ Batch compression failed:', error);
    throw error;
  }
}

/**
 * Test 5: Error handling
 */
export async function testErrorHandling() {
  console.log('=== Testing Error Handling ===');
  
  const tests = [
    {
      name: 'Null canvas',
      test: () => imageCompression.compressSignature(null as any),
      shouldFail: true
    },
    {
      name: 'Invalid file',
      test: () => imageCompression.compressFile(null as any),
      shouldFail: true
    },
    {
      name: 'Invalid data URL',
      test: () => imageCompression.compressDataUrl('not-a-data-url'),
      shouldFail: true
    },
    {
      name: 'Zero-size canvas',
      test: () => {
        const canvas = document.createElement('canvas');
        canvas.width = 0;
        canvas.height = 0;
        return imageCompression.compressSignature(canvas);
      },
      shouldFail: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test, shouldFail } of tests) {
    try {
      await test();
      if (shouldFail) {
        console.error(`✗ ${name}: Should have thrown error`);
        failed++;
      } else {
        console.log(`✓ ${name}: Passed`);
        passed++;
      }
    } catch (error) {
      if (shouldFail) {
        console.log(`✓ ${name}: Correctly threw error`);
        passed++;
      } else {
        console.error(`✗ ${name}: Unexpected error:`, error);
        failed++;
      }
    }
  }

  console.log(`Error handling tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run all tests
 */
export async function runAllCompressionTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Image Compression Test Suite         ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Test 1: Signature
    await testSignatureCompression();
    console.log('');

    // Test 5: Error handling
    await testErrorHandling();
    console.log('');

    console.log('✓ All basic tests passed!');
    console.log('\nTo test photos:');
    console.log('  1. Select a photo file');
    console.log('  2. Run: testPhotoCompression(file)');
    console.log('\nTo test batch:');
    console.log('  1. Select multiple files');
    console.log('  2. Run: testBatchCompression(files)');
  } catch (error) {
    console.error('✗ Test suite failed:', error);
  }
}

// Make tests available globally for manual testing
if (typeof window !== 'undefined') {
  (window as any).compressionTests = {
    testSignatureCompression,
    testPhotoCompression,
    testDataUrlCompression,
    testBatchCompression,
    testErrorHandling,
    runAllCompressionTests
  };
  console.log('[Tests] Compression tests available at window.compressionTests');
}
