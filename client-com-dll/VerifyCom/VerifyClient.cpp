// VerifyClient.cpp — HTTP 通信 + 机器码采集 + JSON 辅助

#include "VerifyCom.h"
#include <winhttp.h>
#include <iphlpapi.h>
#include <iptypes.h>
#include <wincrypt.h>
#include <tlhelp32.h>
#include <algorithm>
#include <sstream>
#include <vector>

#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "advapi32.lib")

// =====================================================================
// JSON 辅助
// =====================================================================

std::wstring EscapeJsonString(const std::wstring& s) {
    std::wstring out;
    out.reserve(s.size() + 8);
    for (wchar_t c : s) {
        switch (c) {
        case L'"':  out += L"\\\""; break;
        case L'\\': out += L"\\\\"; break;
        case L'\n': out += L"\\n"; break;
        case L'\r': out += L"\\r"; break;
        case L'\t': out += L"\\t"; break;
        default:    out += c; break;
        }
    }
    return out;
}

std::wstring BuildJsonResult(bool success, int code, const std::wstring& message, const std::wstring& dataJson) {
    return L"{\"success\":" + std::wstring(success ? L"true" : L"false")
        + L",\"code\":" + std::to_wstring(code)
        + L",\"message\":\"" + EscapeJsonString(message) + L"\""
        + L",\"data\":" + dataJson
        + L"}";
}

static std::wstring ToLower(std::wstring s) {
    std::transform(s.begin(), s.end(), s.begin(), ::towlower);
    return s;
}

std::wstring ExtractJsonString(const std::wstring& json, const std::wstring& key) {
    std::wstring needle = L"\"" + key + L"\"";
    size_t pos = json.find(needle);
    if (pos == std::wstring::npos) return L"";
    pos = json.find(L":", pos + needle.size());
    if (pos == std::wstring::npos) return L"";
    pos++;
    while (pos < json.size() && iswspace(json[pos])) pos++;
    if (pos >= json.size()) return L"";
    if (json[pos] == L'"') {
        pos++;
        std::wstring out;
        bool esc = false;
        for (; pos < json.size(); pos++) {
            wchar_t c = json[pos];
            if (esc) {
                switch (c) {
                case L'n': out += L'\n'; break;
                case L'r': out += L'\r'; break;
                case L't': out += L'\t'; break;
                default: out += c; break;
                }
                esc = false;
                continue;
            }
            if (c == L'\\') {
                esc = true;
                continue;
            }
            if (c == L'"') break;
            out += c;
        }
        return out;
    }
    size_t end = pos;
    while (end < json.size() && json[end] != L',' && json[end] != L'}' && !iswspace(json[end])) end++;
    return json.substr(pos, end - pos);
}

long ExtractJsonLong(const std::wstring& json, const std::wstring& key, long fallback) {
    std::wstring value = ExtractJsonString(json, key);
    if (value.empty()) return fallback;
    return _wtol(value.c_str());
}

bool ExtractJsonSuccess(const std::wstring& json) {
    std::wstring lower = ToLower(json);
    return lower.find(L"\"success\":true") != std::wstring::npos
        || lower.find(L"\"ok\":true") != std::wstring::npos
        || lower.find(L"\"valid\":true") != std::wstring::npos
        || lower.find(L"\"code\":0") != std::wstring::npos
        || lower.find(L"\"status\":\"ok\"") != std::wstring::npos
        || lower.find(L"\"status\":\"valid\"") != std::wstring::npos;
}

// =====================================================================
// HTTP 辅助：解析 URL 为 host + path
// =====================================================================
struct UrlParts {
    std::wstring host;
    int port;
    std::wstring path;
    bool https;
};

static UrlParts ParseUrl(const std::wstring& url) {
    UrlParts p = {};
    p.port = 80;
    p.https = false;
    size_t pos = url.find(L"://");
    if (pos != std::wstring::npos) {
        std::wstring scheme = url.substr(0, pos);
        std::transform(scheme.begin(), scheme.end(), scheme.begin(), ::towlower);
        p.https = (scheme == L"https");
        p.port = p.https ? 443 : 80;
        pos += 3;
    }
    else {
        pos = 0;
    }
    size_t slashPos = url.find(L'/', pos);
    std::wstring authority = (slashPos != std::wstring::npos) ? url.substr(pos, slashPos - pos) : url.substr(pos);
    p.path = (slashPos != std::wstring::npos) ? url.substr(slashPos) : L"/";

    size_t colonPos = authority.rfind(L':');
    if (colonPos != std::wstring::npos) {
        p.host = authority.substr(0, colonPos);
        p.port = _wtoi(authority.substr(colonPos + 1).c_str());
    }
    else {
        p.host = authority;
    }
    return p;
}

// =====================================================================
// HTTP POST
// =====================================================================
std::wstring HttpPost(const std::wstring& url, const std::wstring& body) {
    UrlParts u = ParseUrl(url);
    HINTERNET hSession = ::WinHttpOpen(L"VerifySys/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, nullptr, nullptr, 0);
    if (!hSession) return BuildJsonResult(false, -1, L"WinHttpOpen failed");

    HINTERNET hConnect = ::WinHttpConnect(hSession, u.host.c_str(), (INTERNET_PORT)u.port, 0);
    if (!hConnect) {
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpConnect failed");
    }

    DWORD flags = u.https ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hRequest = ::WinHttpOpenRequest(hConnect, L"POST", u.path.c_str(), nullptr, nullptr, nullptr, flags);
    if (!hRequest) {
        ::WinHttpCloseHandle(hConnect);
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpOpenRequest failed");
    }

    LPCWSTR headers = L"Content-Type: application/json\r\n";
    ::WinHttpAddRequestHeaders(hRequest, headers, (DWORD)-1, WINHTTP_ADDREQ_FLAG_ADD);

    std::string bodyUtf8;
    {
        int len = ::WideCharToMultiByte(CP_UTF8, 0, body.c_str(), (int)body.size(), nullptr, 0, nullptr, nullptr);
        bodyUtf8.resize(len);
        ::WideCharToMultiByte(CP_UTF8, 0, body.c_str(), (int)body.size(), &bodyUtf8[0], len, nullptr, nullptr);
    }

    BOOL ok = ::WinHttpSendRequest(hRequest, nullptr, 0, (LPVOID)bodyUtf8.c_str(), (DWORD)bodyUtf8.size(), (DWORD)bodyUtf8.size(), 0);
    if (!ok) {
        ::WinHttpCloseHandle(hRequest);
        ::WinHttpCloseHandle(hConnect);
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpSendRequest failed");
    }

    ::WinHttpReceiveResponse(hRequest, nullptr);

    std::string response;
    DWORD bytesRead = 0;
    char buffer[4096];
    do {
        DWORD bytesAvailable = 0;
        ::WinHttpQueryDataAvailable(hRequest, &bytesAvailable);
        if (!bytesAvailable) break;
        ::WinHttpReadData(hRequest, buffer, sizeof(buffer), &bytesRead);
        if (bytesRead > 0) response.append(buffer, bytesRead);
    } while (bytesRead > 0);

    ::WinHttpCloseHandle(hRequest);
    ::WinHttpCloseHandle(hConnect);
    ::WinHttpCloseHandle(hSession);

    // 转 wstring
    int wlen = ::MultiByteToWideChar(CP_UTF8, 0, response.c_str(), (int)response.size(), nullptr, 0);
    std::wstring wresult(wlen, 0);
    ::MultiByteToWideChar(CP_UTF8, 0, response.c_str(), (int)response.size(), &wresult[0], wlen);
    return wresult;
}

// =====================================================================
// HTTP GET
// =====================================================================
std::wstring HttpGet(const std::wstring& url) {
    UrlParts u = ParseUrl(url);
    HINTERNET hSession = ::WinHttpOpen(L"VerifySys/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, nullptr, nullptr, 0);
    if (!hSession) return BuildJsonResult(false, -1, L"WinHttpOpen failed");

    HINTERNET hConnect = ::WinHttpConnect(hSession, u.host.c_str(), (INTERNET_PORT)u.port, 0);
    if (!hConnect) {
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpConnect failed");
    }

    DWORD flags = u.https ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hRequest = ::WinHttpOpenRequest(hConnect, L"GET", u.path.c_str(), nullptr, nullptr, nullptr, flags);
    if (!hRequest) {
        ::WinHttpCloseHandle(hConnect);
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpOpenRequest failed");
    }

    BOOL ok = ::WinHttpSendRequest(hRequest, nullptr, 0, nullptr, 0, 0, 0);
    if (!ok) {
        ::WinHttpCloseHandle(hRequest);
        ::WinHttpCloseHandle(hConnect);
        ::WinHttpCloseHandle(hSession);
        return BuildJsonResult(false, -1, L"WinHttpSendRequest failed");
    }

    ::WinHttpReceiveResponse(hRequest, nullptr);

    std::string response;
    DWORD bytesRead = 0;
    char buffer[4096];
    do {
        DWORD bytesAvailable = 0;
        ::WinHttpQueryDataAvailable(hRequest, &bytesAvailable);
        if (!bytesAvailable) break;
        ::WinHttpReadData(hRequest, buffer, sizeof(buffer), &bytesRead);
        if (bytesRead > 0) response.append(buffer, bytesRead);
    } while (bytesRead > 0);

    ::WinHttpCloseHandle(hRequest);
    ::WinHttpCloseHandle(hConnect);
    ::WinHttpCloseHandle(hSession);

    int wlen = ::MultiByteToWideChar(CP_UTF8, 0, response.c_str(), (int)response.size(), nullptr, 0);
    std::wstring wresult(wlen, 0);
    ::MultiByteToWideChar(CP_UTF8, 0, response.c_str(), (int)response.size(), &wresult[0], wlen);
    return wresult;
}

// =====================================================================
// 机器码：组合 CPU + 硬盘 + MAC，取 SHA256 摘要
// =====================================================================
static std::wstring GetCPUSerial() {
    std::wstring serial;
    HKEY hKey = nullptr;
    if (::RegOpenKeyExW(HKEY_LOCAL_MACHINE,
        L"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0",
        0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        wchar_t buf[256] = {};
        DWORD size = sizeof(buf);
        if (::RegQueryValueExW(hKey, L"ProcessorNameString", nullptr, nullptr, (LPBYTE)buf, &size) == ERROR_SUCCESS) {
            serial = buf;
        }
        ::RegCloseKey(hKey);
    }

    // 补充：用环境变量补充计算机名+用户名增加唯一性
    wchar_t computerName[256] = {};
    DWORD cnSize = 256;
    ::GetComputerNameW(computerName, &cnSize);
    serial += computerName;

    return serial;
}

static std::wstring ReadRegString(HKEY root, const wchar_t* path, const wchar_t* name) {
    HKEY hKey = nullptr;
    std::wstring value;
    if (::RegOpenKeyExW(root, path, 0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
        wchar_t buf[1024] = {};
        DWORD size = sizeof(buf);
        if (::RegQueryValueExW(hKey, name, nullptr, nullptr, (LPBYTE)buf, &size) == ERROR_SUCCESS) {
            value = buf;
        }
        ::RegCloseKey(hKey);
    }
    return value;
}

static std::wstring GetBIOSInfo() {
    return ReadRegString(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"BIOSVendor") + L"|"
        + ReadRegString(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"BIOSVersion") + L"|"
        + ReadRegString(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"BaseBoardManufacturer") + L"|"
        + ReadRegString(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\BIOS", L"BaseBoardProduct");
}

static std::wstring GetMachineGuid() {
    return ReadRegString(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Cryptography", L"MachineGuid");
}

static std::wstring GetDiskSerial() {
    std::wstring serial;
    DWORD volSerial = 0;
    if (::GetVolumeInformationW(L"C:\\", nullptr, 0, &volSerial, nullptr, nullptr, nullptr, 0)) {
        wchar_t buf[32];
        swprintf_s(buf, L"%08X", volSerial);
        serial = buf;
    }
    return serial;
}

static std::wstring GetMAC() {
    std::wstring mac;
    ULONG bufLen = 0;
    ::GetAdaptersAddresses(AF_INET, 0, nullptr, nullptr, &bufLen);
    if (bufLen == 0) return mac;

    std::vector<BYTE> buffer(bufLen);
    PIP_ADAPTER_ADDRESSES addrs = (PIP_ADAPTER_ADDRESSES)buffer.data();
    if (::GetAdaptersAddresses(AF_INET, 0, nullptr, addrs, &bufLen) != ERROR_SUCCESS) return mac;

    for (auto a = addrs; a; a = a->Next) {
        if (a->PhysicalAddressLength != 6) continue;
        if (a->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;
        if (!mac.empty()) mac += L"|";
        if (a->FriendlyName) mac += a->FriendlyName;
        mac += L":";
        if (a->Description) mac += a->Description;
        mac += L":";
        mac += std::to_wstring(a->IfType);
        mac += L":";
        for (UINT i = 0; i < a->PhysicalAddressLength; i++) {
            wchar_t hex[4];
            swprintf_s(hex, L"%02X", a->PhysicalAddress[i]);
            mac += hex;
            if (i < a->PhysicalAddressLength - 1) mac += L"-";
        }
    }
    return mac;
}

// 简单 hash：把字符串混合成固定长度十六进制
static std::vector<BYTE> Sha256Bytes(const BYTE* data, DWORD dataLen) {
    std::vector<BYTE> out;
    HCRYPTPROV hProv = 0;
    HCRYPTHASH hHash = 0;

    if (!::CryptAcquireContextW(&hProv, nullptr, nullptr, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) {
        return out;
    }

    if (::CryptCreateHash(hProv, CALG_SHA_256, 0, 0, &hHash)) {
        if (::CryptHashData(hHash, data, dataLen, 0)) {
            BYTE hashBuf[32];
            DWORD hashLen = 32;
            if (::CryptGetHashParam(hHash, HP_HASHVAL, hashBuf, &hashLen, 0)) {
                out.assign(hashBuf, hashBuf + hashLen);
            }
        }
        ::CryptDestroyHash(hHash);
    }
    ::CryptReleaseContext(hProv, 0);
    return out;
}

static std::string WstrToUtf8(const std::wstring& input) {
    if (input.empty()) return std::string();
    int len = ::WideCharToMultiByte(CP_UTF8, 0, input.c_str(), (int)input.size(), nullptr, 0, nullptr, nullptr);
    std::string out(len, 0);
    ::WideCharToMultiByte(CP_UTF8, 0, input.c_str(), (int)input.size(), &out[0], len, nullptr, nullptr);
    return out;
}

static std::wstring HexLower(const std::vector<BYTE>& bytes) {
    std::wstring result;
    for (BYTE b : bytes) {
        wchar_t hex[4];
        swprintf_s(hex, L"%02x", b);
        result += hex;
    }
    return result;
}

std::wstring Sha256Hex(const std::wstring& input) {
    std::string utf8 = WstrToUtf8(input);
    return HexLower(Sha256Bytes((const BYTE*)utf8.data(), (DWORD)utf8.size()));
}

std::wstring HmacSha256Hex(const std::wstring& material, const std::wstring& secret) {
    std::string keyUtf8 = WstrToUtf8(secret);
    std::string dataUtf8 = WstrToUtf8(material);
    std::vector<BYTE> key(keyUtf8.begin(), keyUtf8.end());
    if (key.size() > 64) {
        key = Sha256Bytes(key.data(), (DWORD)key.size());
    }
    key.resize(64, 0);

    std::vector<BYTE> ipad(64), opad(64);
    for (size_t i = 0; i < 64; i++) {
        ipad[i] = key[i] ^ 0x36;
        opad[i] = key[i] ^ 0x5c;
    }
    std::vector<BYTE> innerData = ipad;
    innerData.insert(innerData.end(), dataUtf8.begin(), dataUtf8.end());
    std::vector<BYTE> inner = Sha256Bytes(innerData.data(), (DWORD)innerData.size());
    std::vector<BYTE> outerData = opad;
    outerData.insert(outerData.end(), inner.begin(), inner.end());
    return HexLower(Sha256Bytes(outerData.data(), (DWORD)outerData.size()));
}

std::wstring UrlEncode(const std::wstring& input) {
    std::string utf8 = WstrToUtf8(input);
    std::wstring out;
    const wchar_t* hex = L"0123456789ABCDEF";
    for (unsigned char c : utf8) {
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~') {
            out += (wchar_t)c;
        } else {
            out += L'%';
            out += hex[c >> 4];
            out += hex[c & 0x0F];
        }
    }
    return out;
}

std::wstring GetMachineCodeInternal() {
    std::wstring raw = GetCPUSerial() + L"|" + GetDiskSerial() + L"|" + GetBIOSInfo()
        + L"|" + GetMachineGuid() + L"|" + GetMAC();
    return Sha256Hex(raw);
}
