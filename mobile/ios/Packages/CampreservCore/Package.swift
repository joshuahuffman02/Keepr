// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CampreservCore",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "CampreservCore",
            targets: ["CampreservCore"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess.git", from: "4.2.0")
    ],
    targets: [
        .target(
            name: "CampreservCore",
            dependencies: ["KeychainAccess"],
            path: "Sources/CampreservCore"
        ),
        .testTarget(
            name: "CampreservCoreTests",
            dependencies: ["CampreservCore"],
            path: "Tests/CampreservCoreTests"
        )
    ]
)
