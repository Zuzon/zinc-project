# JNI host that runs the embedded Node runtime (digidem/nodejs-mobile).
# scripts/fetch-native.mjs places libnode.so in jniLibs/ and its headers in libnode/.
cmake_minimum_required(VERSION 3.22.1)
project(zinc_node_host CXX)

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES
  IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libnode.so)

add_library(zinc-node-host SHARED node-host.cpp)
target_include_directories(zinc-node-host PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/../../../libnode/include/node)
target_compile_features(zinc-node-host PRIVATE cxx_std_20)
target_link_libraries(zinc-node-host node log)
# Android 15+ devices may use 16 KB pages.
target_link_options(zinc-node-host PRIVATE "-Wl,-z,max-page-size=16384")
