// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CampreservUI",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "CampreservUI",
            targets: ["CampreservUI"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "CampreservUI",
            dependencies: [],
            path: "Sources/CampreservUI"
        ),
        .testTarget(
            name: "CampreservUITests",
            dependencies: ["CampreservUI"],
            path: "Tests/CampreservUITests"
        )
    ]
)
