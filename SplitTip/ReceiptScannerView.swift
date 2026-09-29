import PhotosUI
import SwiftUI
import UIKit

struct ReceiptScanResult {
    let amount: Decimal
    let lines: [String]
}

struct ReceiptScannerView: View {
    let useReceipt: (ReceiptScanResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showingCamera = false
    @State private var imageData: Data?
    @State private var candidates: [ReceiptAmount] = []
    @State private var recognizedLines: [String] = []
    @State private var amountText = ""
    @State private var isRecognizing = false
    @State private var errorMessage: String?

    private var enteredAmount: Decimal? {
        MoneyInputParser.parse(amountText)
    }

    private var isValidAmount: Bool {
        enteredAmount.map { (0...1_000_000_000).contains($0) } ?? false
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let imageData, let image = UIImage(data: imageData) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 180)
                            .accessibilityLabel("Receipt preview")
                    }

                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button {
                            showingCamera = true
                        } label: {
                            Label("Take photo", systemImage: "camera")
                        }
                    }

                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Label("Choose photo", systemImage: "photo")
                    }
                } header: {
                    Text("Receipt")
                } footer: {
                    Text("Recognition happens on your device. Review the amount before using it.")
                }

                if isRecognizing {
                    Section { ProgressView("Reading receipt") }
                }

                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.secondary) }
                }

                if !candidates.isEmpty {
                    Section("Amounts found") {
                        ForEach(candidates) { candidate in
                            Button {
                                amountText = decimalFormatter.string(
                                    from: NSDecimalNumber(decimal: candidate.amount)
                                ) ?? ""
                            } label: {
                                HStack {
                                    Text(candidate.line)
                                        .lineLimit(2)
                                    Spacer()
                                    Text(candidate.amount.formatted(.number))
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Use bill amount") {
                    TextField("Amount", text: $amountText)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("scannedAmount")
                    Button("Use amount") {
                        guard let enteredAmount, isValidAmount else { return }
                        useReceipt(ReceiptScanResult(amount: enteredAmount, lines: recognizedLines))
                        dismiss()
                    }
                    .disabled(!isValidAmount)
                    .accessibilityIdentifier("useScannedAmount")
                }
            }
            .navigationTitle("Scan receipt")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: $showingCamera) {
                CameraPicker(isPresented: $showingCamera) { data in
                    Task { await recognize(data) }
                }
            }
            .onChange(of: selectedPhoto) { item in
                Task {
                    do {
                        guard let data = try await item?.loadTransferable(type: Data.self) else { return }
                        await recognize(data)
                    } catch {
                        errorMessage = "Could not open the selected photo."
                    }
                }
            }
        }
    }

    private var decimalFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = .current
        formatter.maximumFractionDigits = 2
        return formatter
    }

    private func recognize(_ data: Data) async {
        imageData = data
        candidates = []
        recognizedLines = []
        amountText = ""
        errorMessage = nil
        isRecognizing = true
        defer { isRecognizing = false }
        do {
            let lines = try await ReceiptOCR.recognizeLines(in: data)
            recognizedLines = lines
            candidates = ReceiptAmountParser.candidates(in: lines)
            if let first = candidates.first {
                amountText = decimalFormatter.string(from: NSDecimalNumber(decimal: first.amount)) ?? ""
            } else {
                errorMessage = "No amount found. You can enter the bill amount below."
            }
        } catch {
            errorMessage = "Could not read this image. You can enter the bill amount below."
        }
    }
}

private struct CameraPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onCapture: (Data) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(isPresented: $isPresented, onCapture: onCapture)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let isPresented: Binding<Bool>
        let onCapture: (Data) -> Void

        init(isPresented: Binding<Bool>, onCapture: @escaping (Data) -> Void) {
            self.isPresented = isPresented
            self.onCapture = onCapture
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage,
               let data = image.jpegData(compressionQuality: 0.85) {
                onCapture(data)
            }
            isPresented.wrappedValue = false
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            isPresented.wrappedValue = false
            picker.dismiss(animated: true)
        }
    }
}
