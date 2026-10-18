// Starts Node.js inside the app process and forwards stdout and stderr to
// logcat. They are process-wide, so native libraries' output shows up too. Called from NodeHost.java on a dedicated thread; it returns
// only when Node exits, and Node can run only once per process.
#include <android/log.h>
#include <jni.h>
#include <node.h>
#include <pthread.h>
#include <unistd.h>

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace {

constexpr const char* kTag = "zinc-stdio";

struct Redirect {
  int fd;
  int priority;
};

void* PumpToLogcat(void* arg) {
  const Redirect redirect = *static_cast<Redirect*>(arg);
  delete static_cast<Redirect*>(arg);
  char buffer[4096];
  std::string line;
  ssize_t size;
  while ((size = read(redirect.fd, buffer, sizeof buffer)) > 0) {
    line.append(buffer, static_cast<size_t>(size));
    size_t end;
    while ((end = line.find('\n')) != std::string::npos) {
      __android_log_write(redirect.priority, kTag, line.substr(0, end).c_str());
      line.erase(0, end + 1);
    }
  }
  if (!line.empty()) {
    __android_log_write(redirect.priority, kTag, line.c_str());
  }
  return nullptr;
}

bool RedirectToLogcat(int target, int priority) {
  int fds[2];
  if (pipe(fds) != 0 || dup2(fds[1], target) < 0) {
    return false;
  }
  close(fds[1]);
  pthread_t thread;
  if (pthread_create(&thread, nullptr, PumpToLogcat,
                     new Redirect{fds[0], priority}) != 0) {
    return false;
  }
  pthread_detach(thread);
  return true;
}

}  // namespace

extern "C" JNIEXPORT jint JNICALL
Java_app_zinc_navigation_NodeHost_startNode(JNIEnv* env, jclass,
                                            jobjectArray args) {
  setvbuf(stdout, nullptr, _IOLBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);
  if (!RedirectToLogcat(STDOUT_FILENO, ANDROID_LOG_INFO) ||
      !RedirectToLogcat(STDERR_FILENO, ANDROID_LOG_ERROR)) {
    __android_log_write(ANDROID_LOG_WARN, kTag, "cannot redirect output");
  }

  // libuv expects argv to be one contiguous block.
  const jsize argc = env->GetArrayLength(args);
  std::vector<std::string> values;
  size_t size = 0;
  for (jsize i = 0; i < argc; i++) {
    auto arg = static_cast<jstring>(env->GetObjectArrayElement(args, i));
    const char* chars = env->GetStringUTFChars(arg, nullptr);
    values.emplace_back(chars);
    env->ReleaseStringUTFChars(arg, chars);
    env->DeleteLocalRef(arg);
    size += values.back().size() + 1;
  }
  // Node keeps pointers into argv for the lifetime of the process.
  char* block = new char[size];
  std::vector<char*> argv;
  char* cursor = block;
  for (const std::string& value : values) {
    std::memcpy(cursor, value.c_str(), value.size() + 1);
    argv.push_back(cursor);
    cursor += value.size() + 1;
  }
  argv.push_back(nullptr);

  return node::Start(argc, argv.data());
}
