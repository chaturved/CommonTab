import Foundation
import ImageIO
import Vision

enum ReceiptOCRError: Error {
    case invalidImage
}

enum ReceiptOCR {
    static func recognizeLines(in imageData: Data) async throws -> [String] {
        try await Task.detached(priority: .userInitiated) {
            guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                throw ReceiptOCRError.invalidImage
            }

            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as NSDictionary?
            let rawOrientation = properties?[kCGImagePropertyOrientation] as? UInt32 ?? 1
            let orientation = CGImagePropertyOrientation(rawValue: rawOrientation) ?? .up
            try VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])
            return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
        }.value
    }
}
