import AppKit

let canvas = NSSize(width: 1024, height: 1024)
let image = NSImage(size: canvas)
image.lockFocus()

let background = NSBezierPath(rect: NSRect(origin: .zero, size: canvas))
NSGradient(
    starting: NSColor(calibratedRed: 0.03, green: 0.23, blue: 0.25, alpha: 1),
    ending: NSColor(calibratedRed: 0.02, green: 0.12, blue: 0.18, alpha: 1)
)!.draw(in: background, angle: -45)

let glow = NSBezierPath(ovalIn: NSRect(x: 137, y: 128, width: 750, height: 750))
NSColor(calibratedRed: 0.15, green: 0.70, blue: 0.66, alpha: 0.18).setFill()
glow.fill()

let receipt = NSBezierPath(roundedRect: NSRect(x: 262, y: 166, width: 500, height: 696), xRadius: 64, yRadius: 64)
NSColor(calibratedRed: 0.95, green: 0.98, blue: 0.96, alpha: 1).setFill()
receipt.fill()

func bar(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, color: NSColor) {
    let path = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width, height: height), xRadius: height / 2, yRadius: height / 2)
    color.setFill()
    path.fill()
}

let ink = NSColor(calibratedRed: 0.10, green: 0.28, blue: 0.31, alpha: 1)
let mint = NSColor(calibratedRed: 0.16, green: 0.70, blue: 0.59, alpha: 1)
bar(x: 336, y: 730, width: 250, height: 36, color: ink)
bar(x: 336, y: 641, width: 215, height: 24, color: ink.withAlphaComponent(0.38))
bar(x: 615, y: 641, width: 73, height: 24, color: mint)
bar(x: 336, y: 571, width: 190, height: 24, color: ink.withAlphaComponent(0.38))
bar(x: 615, y: 571, width: 73, height: 24, color: mint)
bar(x: 336, y: 501, width: 232, height: 24, color: ink.withAlphaComponent(0.38))
bar(x: 615, y: 501, width: 73, height: 24, color: mint)
bar(x: 336, y: 430, width: 352, height: 12, color: ink.withAlphaComponent(0.16))

let split = NSBezierPath()
split.lineWidth = 30
split.lineCapStyle = .round
split.lineJoinStyle = .round
split.move(to: NSPoint(x: 512, y: 365))
split.line(to: NSPoint(x: 512, y: 304))
split.move(to: NSPoint(x: 512, y: 304))
split.line(to: NSPoint(x: 407, y: 251))
split.move(to: NSPoint(x: 512, y: 304))
split.line(to: NSPoint(x: 617, y: 251))
mint.setStroke()
split.stroke()

for x in [407.0, 617.0] {
    let dot = NSBezierPath(ovalIn: NSRect(x: x - 31, y: 205, width: 62, height: 62))
    mint.setFill()
    dot.fill()
}

image.unlockFocus()

guard let cgContext = CGContext(
    data: nil,
    width: 1024,
    height: 1024,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
    fatalError("Could not create app icon bitmap")
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: cgContext, flipped: false)
image.draw(in: NSRect(origin: .zero, size: canvas))
cgContext.flush()
NSGraphicsContext.restoreGraphicsState()

guard let cgImage = cgContext.makeImage() else { fatalError("Could not render icon") }
let bitmap = NSBitmapImageRep(cgImage: cgImage)
guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not render app icon")
}

let repositoryRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
let iconPath = repositoryRoot.appendingPathComponent("apps/ios/CommonTab/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
try png.write(to: iconPath)
