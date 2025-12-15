<?php
/**
 * KPS Pest Control - PDF Generation Service
 * Simple HTML-to-PDF converter using DomPDF
 * 
 * Usage: php generate-pdf.php <html-file-path> <output-pdf-path>
 * 
 * Arguments:
 *   $argv[1] - Path to HTML file to convert
 *   $argv[2] - Path where PDF should be saved
 */

require_once __DIR__ . '/vendor/autoload.php';

use Dompdf\Dompdf;
use Dompdf\Options;

// Validate arguments
if ($argc < 3) {
    fwrite(STDERR, "Usage: php generate-pdf.php <html-file-path> <output-pdf-path>\n");
    exit(1);
}

$htmlFilePath = $argv[1];
$outputPdfPath = $argv[2];

// Check if HTML file exists
if (!file_exists($htmlFilePath)) {
    fwrite(STDERR, "Error: HTML file not found: {$htmlFilePath}\n");
    exit(1);
}

// Read HTML content
$html = file_get_contents($htmlFilePath);
if ($html === false) {
    fwrite(STDERR, "Error: Failed to read HTML file: {$htmlFilePath}\n");
    exit(1);
}

try {
    // Configure DomPDF
    $options = new Options();
    $options->set('isHtml5ParserEnabled', true);
    $options->set('isPhpEnabled', false);
    $options->set('isRemoteEnabled', true); // Allow remote images (for base64 logos)
    $options->set('defaultFont', 'Arial');
    $options->set('defaultMediaType', 'print');
    $options->set('isFontSubsettingEnabled', true);
    
    // Create PDF instance
    $dompdf = new Dompdf($options);
    
    // Load HTML
    $dompdf->loadHtml($html);
    
    // Set paper size and orientation
    $dompdf->setPaper('A4', 'portrait');
    
    // Render PDF
    $dompdf->render();
    
    // Get PDF output
    $output = $dompdf->output();
    
    // Save to file
    $result = file_put_contents($outputPdfPath, $output);
    if ($result === false) {
        fwrite(STDERR, "Error: Failed to write PDF file: {$outputPdfPath}\n");
        exit(1);
    }
    
    // Success
    echo "PDF generated successfully: {$outputPdfPath}\n";
    exit(0);
    
} catch (Exception $e) {
    fwrite(STDERR, "Error generating PDF: " . $e->getMessage() . "\n");
    exit(1);
}

