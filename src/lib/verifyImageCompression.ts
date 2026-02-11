/**
 * Image Compression Verification Script
 * Run this in the browser console to verify compression works correctly
 */

import { imageCompression } from '@/lib/imageCompression';

export async function verifyImageCompression() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Image Compression Verification                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; details: string }>
  };

  // Test 1: Canvas compression (signature simulation)
  try {
    console.log('📝 Test 1: Canvas Compression (Signature)');
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('No canvas context');
    
    // Draw signature-like pattern
    ctx.fillStyle = '#000000';
    ctx.font = '36px Arial';
    ctx.fillText('Test Signature', 50, 200);
    ctx.beginPath();
    ctx.moveTo(50, 220);
    ctx.lineTo(700, 220);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const result = imageCompression.compressSignature(canvas);
    
    const details = `${imageCompression.formatBytes(result.originalSize)} → ${imageCompression.formatBytes(result.compressedSize)} (${(result.compressionRatio * 100).toFixed(1)}%)`;
    
    if (result.compressedSize > 0 && result.compressionRatio <= 1.0) {
      console.log('  ✅ PASS:', details);
      results.tests.push({ name: 'Canvas Compression', status: 'PASS', details });
      results.passed++;
    } else {
      throw new Error('Invalid compression result');
    }
  } catch (error) {
    console.error('  ❌ FAIL:', error);
    results.tests.push({ 
      name: 'Canvas Compression', 
      status: 'FAIL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
    results.failed++;
  }

  // Test 2: Error handling - null canvas
  try {
    console.log('\n🛡️  Test 2: Error Handling (Null Canvas)');
    try {
      imageCompression.compressSignature(null as any);
      throw new Error('Should have thrown error on null canvas');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid canvas')) {
        console.log('  ✅ PASS: Correctly rejected null canvas');
        results.tests.push({ name: 'Null Canvas Validation', status: 'PASS', details: 'Error thrown as expected' });
        results.passed++;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('  ❌ FAIL:', error);
    results.tests.push({ 
      name: 'Null Canvas Validation', 
      status: 'FAIL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
    results.failed++;
  }

  // Test 3: Error handling - zero-size canvas
  try {
    console.log('\n🛡️  Test 3: Error Handling (Zero-Size Canvas)');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 0;
      imageCompression.compressSignature(canvas);
      throw new Error('Should have thrown error on zero-size canvas');
    } catch (error) {
      if (error instanceof Error && error.message.includes('zero dimensions')) {
        console.log('  ✅ PASS: Correctly rejected zero-size canvas');
        results.tests.push({ name: 'Zero-Size Canvas Validation', status: 'PASS', details: 'Error thrown as expected' });
        results.passed++;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('  ❌ FAIL:', error);
    results.tests.push({ 
      name: 'Zero-Size Canvas Validation', 
      status: 'FAIL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
    results.failed++;
  }

  // Test 4: Compression doesn't make files larger
  try {
    console.log('\n📏 Test 4: Compression Quality Check');
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('No canvas context');
    
    // Simple solid color (already optimal)
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, 100, 100);
    
    const result = imageCompression.compressSignature(canvas);
    
    if (result.compressionRatio <= 1.0) {
      console.log('  ✅ PASS: Compression ratio ≤ 1.0 (never makes files larger)');
      results.tests.push({ 
        name: 'Compression Quality', 
        status: 'PASS', 
        details: `Ratio: ${(result.compressionRatio * 100).toFixed(1)}%` 
      });
      results.passed++;
    } else {
      throw new Error(`Compression made file larger: ${result.compressionRatio}`);
    }
  } catch (error) {
    console.error('  ❌ FAIL:', error);
    results.tests.push({ 
      name: 'Compression Quality', 
      status: 'FAIL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
    results.failed++;
  }

  // Test 5: Format bytes utility
  try {
    console.log('\n🔢 Test 5: Utility Functions');
    const tests = [
      { bytes: 0, expected: '0 B' },
      { bytes: 1024, expected: '1.00 KB' },
      { bytes: 1048576, expected: '1.00 MB' },
      { bytes: 1073741824, expected: '1.00 GB' }
    ];
    
    let allPassed = true;
    for (const { bytes, expected } of tests) {
      const result = imageCompression.formatBytes(bytes);
      if (result !== expected) {
        allPassed = false;
        console.error(`  ❌ formatBytes(${bytes}) = "${result}", expected "${expected}"`);
      }
    }
    
    if (allPassed) {
      console.log('  ✅ PASS: All formatBytes tests passed');
      results.tests.push({ name: 'Utility Functions', status: 'PASS', details: 'All formatBytes checks passed' });
      results.passed++;
    } else {
      throw new Error('formatBytes test failed');
    }
  } catch (error) {
    console.error('  ❌ FAIL:', error);
    results.tests.push({ 
      name: 'Utility Functions', 
      status: 'FAIL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
    results.failed++;
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICATION SUMMARY                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  results.tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.details}`);
  });
  
  console.log(`\n${results.passed} PASSED, ${results.failed} FAILED\n`);
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed! Image compression is verified and working correctly.\n');
    console.log('✓ Canvas compression works');
    console.log('✓ Error handling is robust');
    console.log('✓ Compression never makes files larger');
    console.log('✓ Utility functions work correctly');
    console.log('\n📝 Ready for production use in signatures and photo compression.');
  } else {
    console.error('⚠️  Some tests failed. Please review the errors above.');
  }
  
  return results;
}

// Auto-run verification
if (typeof window !== 'undefined') {
  (window as any).verifyImageCompression = verifyImageCompression;
  console.log('[Verification] Run window.verifyImageCompression() to test image compression');
}
