// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NovaForgeMac",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "NovaForgeStudio", targets: ["Studio"]),
        .executable(name: "NovaForgeFlash", targets: ["Flash"])
    ],
    targets: [
        .target(name: "Shared", path: "Sources/Shared"),
        .executableTarget(name: "Studio", dependencies: ["Shared"], path: "Sources/Studio"),
        .executableTarget(name: "Flash", dependencies: ["Shared"], path: "Sources/Flash")
    ]
)
