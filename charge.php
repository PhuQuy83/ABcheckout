
<?php
header("Content-Type: application/json");

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid JSON input"]);
    exit;
}

// Extract required fields
$nonce        = $input["nonce"]        ?? null;
$expiryMonth  = $input["expiryMonth"]  ?? null;
$expiryYear   = $input["expiryYear"]   ?? null;
//$maskedCvv2   = $input["maskedCvv2"]   ?? null;
$amount       = isset($input["amount"]) ? floatval($input["amount"]) : null;
$eci          = $input["eci"]          ?? null;
$cavv         = $input["cavv"]         ?? null;
$xid          = $input["xid"]          ?? null;
$threeDSVersion = $input["threeDSVersion"] ?? null;
$dsTransactionId = $input["dsTransactionId"] ?? null;
$threeDSResult = $input["threeDSResult"] ?? null;

// Optional customer info
$customer     = $input["customer"]     ?? [];
$avs_address  = $customer["address"]   ?? "";
$avs_zip      = $customer["zip"]       ?? "";

// Validate required fields
if (!$nonce || !$expiryMonth || !$expiryYear || !$amount) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields",
        "received" => $input
    ]);
    exit;
}


// Validate expiration
$expiry_month = intval($expiryMonth);
$expiry_year  = intval($expiryYear);

if ($expiry_month < 1 || $expiry_month > 12) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "expiry_month must be 1–12"]);
    exit;
}

if ($expiry_year < 2020) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "expiry_year must be >= 2020"]);
    exit;
}

// Build gateway payload
$data = [
    "source"        => $nonce,
    "amount"        => $amount,
    "expiry_month"  => $expiry_month,
    "expiry_year"   => $expiry_year,
    //"cvv2"    => $maskedCvv2,
    "avs_address"   => $customer["address"],
    "avs_zip"       => $customer["zip"],
    "save_card"     => true,
];

// Optionally attach 3DS data when present
//if (is_array($threeDSResult) && !empty($threeDSResult["eci"])) {
//    $data["3d_secure"] = [
//        "eci"         => $threeDSResult["eci"] ?? "null",
//        "cavv"        => $threeDSResult["authenticationValue"] ?? "testing-purposes-only-not-real",
       // "ds_trans_id" => $threeDSResult["directoryServerTransactionId"] ?? "testing-purposes-only-not-real-ds-trans-id",
//    ];
//}

$payload = json_encode($data);

// Send to EchelonSecure
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL            => "https://api.sandbox.echelonsecure.app/v2/transactions/charge",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ["Content-Type: application/json"],
    CURLOPT_USERPWD        => "z9t3zEs5ZgNEIsLWTWb6Zx49DyXjMne7:8686"
]);

$response = curl_exec($ch);
$error    = curl_error($ch);

curl_close($ch);

// Handle cURL errors
if ($error) {
    http_response_code(502);
    echo json_encode([
        "success" => false,
        "message" => "Gateway connection error",
        "curl_error" => $error
    ]);
    exit;
}

// Parse gateway JSON
$parsed = json_decode($response, true);

if (!$parsed) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON from gateway",
        "raw" => $response
    ]);
    exit;
}

// Build final response in a friendlier, consistent shape
// Treat typical "approved"/"success" style statuses as successful; otherwise fall back to HTTP 200 as success.
$status   = $parsed["status"] ?? null;
$success  = false;
if (is_bool($status)) {
    $success = $status;
} elseif (is_string($status)) {
    $success = in_array(strtolower($status), ["approved", "success", "succeeded", "captured"], true);
} else {
    // If no explicit status field, assume success when we got valid JSON and HTTP 200
    $success = true;
}

$message =
    $parsed["message"]        ??
    $parsed["status_message"] ??
    $parsed["status_code"]    ??
    null;

echo json_encode([
    "success"          => $success,
    "status"           => $status,
    "message"          => $message,
    "transaction_id"   => $parsed["transaction_id"] ?? null,
    "auth_code"        => $parsed["auth_code"] ?? null,
    "last_4"           => $parsed["last_4"] ?? null,
    "reference_number" => $parsed["reference_number"] ?? null,
    "gatewayResponse"  => $parsed
]);
