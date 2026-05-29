#include <initguid.h>
// VerifyCom.cpp — COM 组件核心：IUnknown + IDispatch + 类厂 + DLL 入口

#include "VerifyCom.h"
#include <cstdio>
#include <cstring>
#include <cwctype>
#include <algorithm>
#include <vector>

// 全局引用计数
static LONG g_cRef = 0;

// =====================================================================
// 辅助：BSTR 转 wstring
// =====================================================================
static inline std::wstring BstrToWstr(BSTR b) {
    return b ? std::wstring(b, ::SysStringLen(b)) : std::wstring();
}

// =====================================================================
// DISPID 映射表
// =====================================================================
struct MethodEntry {
    const wchar_t* name;
    DISPID id;
};

static const MethodEntry g_methods[] = {
    { L"Init",                          1 },
    { L"SetServer",                     2 },
    { L"SetSecret",                     3 },
    { L"SetTimeout",                    4 },
    { L"SetIgnoreCertErrors",           5 },
    { L"GetVersion",                    6 },
    { L"GetMachineCode",                7 },
    { L"Verify",                        8 },
    { L"VerifyEx",                      9 },
    { L"Bind",                         10 },
    { L"UnbindEx",                     11 },
    { L"Heartbeat",                    12 },
    { L"Logout",                       13 },
    { L"TrialLogin",                   14 },
    { L"GetRemainSeconds",             15 },
    { L"GetExpireTime",                16 },
    { L"GetLicenseInfo",               17 },
    { L"GetPlacard",                   18 },
    { L"GetCustomData",                19 },
    { L"SetClientInfo",                20 },
    { L"ReportEvent",                  21 },
    { L"GetLastStatus",                22 },
    { L"GetLastCode",                  23 },
    { L"GetLastMessage",               24 },
    { L"GetLastError",                 25 },
    { L"GetLastResponse",              26 },
    { L"Get_Plugin_Description",       27 },
    { L"Get_Plugin_Interpret_Template", 28 },

    // legacy names
    { L"Login",                        101 },
    { L"Unbind",                       102 },
    { L"GetServerTime",                103 },
    { L"SetApiBase",                   104 },
    { L"Charge",                       105 },
    { L"SetCustomData",                106 },
};
static const int g_methodCount = sizeof(g_methods) / sizeof(g_methods[0]);

// =====================================================================
// VerifyClient 实现
// =====================================================================

VerifyClient::VerifyClient()
    : m_cRef(1), m_apiBase(DEFAULT_API_BASE), m_lastStatus(0), m_lastCode(0),
      m_remainSeconds(0), m_timeoutMs(10000), m_ignoreCertErrors(0) {
    InterlockedIncrement(&g_cRef);
}

VerifyClient::~VerifyClient() {
    InterlockedDecrement(&g_cRef);
}

// ---- IUnknown ----
STDMETHODIMP VerifyClient::QueryInterface(REFIID riid, void** ppv) {
    if (!ppv) return E_POINTER;
    if (riid == IID_IUnknown || riid == IID_IDispatch || riid == IID_IVerifyClient) {
        *ppv = static_cast<IDispatch*>(this);
        AddRef();
        return S_OK;
    }
    *ppv = nullptr;
    return E_NOINTERFACE;
}

STDMETHODIMP_(ULONG) VerifyClient::AddRef() {
    return InterlockedIncrement(&m_cRef);
}

STDMETHODIMP_(ULONG) VerifyClient::Release() {
    LONG c = InterlockedDecrement(&m_cRef);
    if (c == 0) delete this;
    return c;
}

// ---- IDispatch ----
STDMETHODIMP VerifyClient::GetTypeInfoCount(UINT* pctinfo) {
    if (!pctinfo) return E_POINTER;
    *pctinfo = 0;
    return S_OK;
}

STDMETHODIMP VerifyClient::GetTypeInfo(UINT, LCID, ITypeInfo** pptinfo) {
    if (!pptinfo) return E_POINTER;
    *pptinfo = nullptr;
    return E_NOTIMPL;
}

STDMETHODIMP VerifyClient::GetIDsOfNames(REFIID, LPOLESTR* rgszNames, UINT cNames, LCID, DISPID* rgdispid) {
    for (UINT i = 0; i < cNames; i++) {
        rgdispid[i] = DISPID_UNKNOWN;
        for (int j = 0; j < g_methodCount; j++) {
            if (_wcsicmp(rgszNames[i], g_methods[j].name) == 0) {
                rgdispid[i] = g_methods[j].id;
                break;
            }
        }
    }
    return (cNames == 1 && rgdispid[0] == DISPID_UNKNOWN) ? DISP_E_UNKNOWNNAME : S_OK;
}

// 从 DISPPARAMS 取参数（反向，因为 COM 按反序压参）
static BSTR GetParam(DISPPARAMS* pdp, UINT index) {
    if (!pdp || index >= pdp->cArgs) return nullptr;
    VARIANTARG& arg = pdp->rgvarg[pdp->cArgs - 1 - index];
    if (arg.vt == VT_BSTR) return arg.bstrVal;
    return nullptr;
}

static LONG GetLongParam(DISPPARAMS* pdp, UINT index) {
    if (!pdp || index >= pdp->cArgs) return 0;
    VARIANTARG& arg = pdp->rgvarg[pdp->cArgs - 1 - index];
    if (arg.vt == VT_I4 || arg.vt == VT_INT) return arg.lVal;
    if (arg.vt == VT_I2) return arg.iVal;
    if (arg.vt == VT_BOOL) return arg.boolVal ? 1 : 0;
    if (arg.vt == VT_BSTR && arg.bstrVal) return _wtoi(arg.bstrVal);
    return 0;
}

static BSTR AllocResult(const std::wstring& ws) {
    return ::SysAllocStringLen(ws.c_str(), (UINT)ws.size());
}

STDMETHODIMP VerifyClient::Invoke(DISPID dispid, REFIID, LCID, WORD wFlags,
    DISPPARAMS* pdispparams, VARIANT* pvarResult, EXCEPINFO*, UINT*) {
    if (!(wFlags & DISPATCH_METHOD)) return DISP_E_MEMBERNOTFOUND;
    if (!pvarResult) return E_POINTER;

    VariantInit(pvarResult);
    pvarResult->vt = VT_EMPTY;

    BSTR p0 = GetParam(pdispparams, 0);
    BSTR p1 = GetParam(pdispparams, 1);
    BSTR p2 = GetParam(pdispparams, 2);
    BSTR p3 = GetParam(pdispparams, 3);
    LONG n0 = GetLongParam(pdispparams, 0);

    BSTR result = nullptr;
    LONG longResult = 0;
    HRESULT hr = S_OK;

    switch (dispid) {
    case 1:  hr = Init(p0, p1, p2, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 2:  hr = SetServer(p0, p1, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 3:  hr = SetSecret(p0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 4:  hr = SetTimeout(n0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 5:  hr = SetIgnoreCertErrors(n0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 6:  hr = GetVersion(&result); break;
    case 7:  hr = GetMachineCode(&result); break;
    case 8:  hr = Verify(p0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 9:  hr = VerifyEx(p0, p1, p2, p3, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 10: hr = Bind(p0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 11: hr = UnbindEx(p0, p1, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 12: hr = Heartbeat(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 13: hr = Logout(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 14: hr = TrialLogin(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 15: hr = GetRemainSeconds(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 16: hr = GetExpireTime(&result); break;
    case 17: hr = GetLicenseInfo(&result); break;
    case 18: hr = GetPlacard(&result); break;
    case 19: hr = GetCustomData(p0, &result); break;
    case 20: hr = SetClientInfo(p0, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 21: hr = ReportEvent(p0, p1, &longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 22: hr = GetLastStatus(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 23: hr = GetLastCode(&longResult); pvarResult->vt = VT_I4; pvarResult->lVal = longResult; return hr;
    case 24: hr = GetLastMessage(&result); break;
    case 25: hr = GetLastError(&result); break;
    case 26: hr = GetLastResponse(&result); break;
    case 27: hr = Get_Plugin_Description(p0, &result); break;
    case 28: hr = Get_Plugin_Interpret_Template(p0, &result); break;

    case 101: hr = Login(p0, p1, p2, &result); break;
    case 102: hr = Unbind(p0, p1, p2, p3, &result); break;
    case 103: hr = GetServerTime(&result); break;
    case 104: SetApiBase(p0); result = AllocResult(L"{\"success\":true}"); break;
    case 105: hr = Charge(p0, p1, p2, &result); break;
    case 106: hr = SetCustomData(p0, p1, p2, &result); break;
    default: return DISP_E_MEMBERNOTFOUND;
    }

    pvarResult->vt = VT_BSTR;
    pvarResult->bstrVal = result;
    return hr;
}

// =====================================================================
// 类厂
// =====================================================================
class VerifyClientFactory : public IClassFactory {
public:
    STDMETHOD(QueryInterface)(REFIID riid, void** ppv) {
        if (!ppv) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_IClassFactory) {
            *ppv = static_cast<IClassFactory*>(this);
            AddRef();
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }
    STDMETHOD_(ULONG, AddRef)() { return InterlockedIncrement(&m_cRef); }
    STDMETHOD_(ULONG, Release)() {
        LONG c = InterlockedDecrement(&m_cRef);
        if (c == 0) delete this;
        return c;
    }
    STDMETHOD(CreateInstance)(IUnknown* pUnk, REFIID riid, void** ppv) {
        if (pUnk) return CLASS_E_NOAGGREGATION;
        if (!ppv) return E_POINTER;
        VerifyClient* pObj = new (std::nothrow) VerifyClient();
        if (!pObj) return E_OUTOFMEMORY;
        HRESULT hr = pObj->QueryInterface(riid, ppv);
        pObj->Release();
        return hr;
    }
    STDMETHOD(LockServer)(BOOL fLock) {
        if (fLock) InterlockedIncrement(&g_cRef);
        else InterlockedDecrement(&g_cRef);
        return S_OK;
    }
private:
    LONG m_cRef = 1;
};

// =====================================================================
// DLL 导出
// =====================================================================
STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, void** ppv) {
    if (rclsid != CLSID_VerifyClient) return CLASS_E_CLASSNOTAVAILABLE;
    VerifyClientFactory* pFac = new (std::nothrow) VerifyClientFactory();
    if (!pFac) return E_OUTOFMEMORY;
    HRESULT hr = pFac->QueryInterface(riid, ppv);
    pFac->Release();
    return hr;
}

STDAPI DllCanUnloadNow() {
    return (g_cRef == 0) ? S_OK : S_FALSE;
}

// 注册 COM（写注册表）
STDAPI DllRegisterServer() {
    HKEY hKey = nullptr;
    wchar_t szModule[MAX_PATH];
    ::GetModuleFileNameW(g_hInst, szModule, MAX_PATH);

    // CLSID
    wchar_t szClsid[] = L"CLSID\\{8D83E26C-4A8D-45C1-9D8C-45D566D69731}";
    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, szClsid, 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, L"QMPlugin Auth Component", 0);
    ::RegCloseKey(hKey);

    wchar_t szInproc[256];
    wcscpy_s(szInproc, szClsid);
    wcscat_s(szInproc, L"\\InprocServer32");
    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, szInproc, 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, szModule, 0);
    ::RegSetValueExW(hKey, L"ThreadingModel", 0, REG_SZ, (const BYTE*)L"Apartment", 20);
    ::RegCloseKey(hKey);

    // ProgID
    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth.1", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, L"QMPlugin Auth Component", 0);
    ::RegCloseKey(hKey);

    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth.1\\CLSID", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, L"{8D83E26C-4A8D-45C1-9D8C-45D566D69731}", 0);
    ::RegCloseKey(hKey);

    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, L"QMPlugin Auth Component", 0);
    ::RegCloseKey(hKey);

    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth\\CLSID", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) != ERROR_SUCCESS)
        return SELFREG_E_CLASS;
    ::RegSetValueW(hKey, nullptr, REG_SZ, L"{8D83E26C-4A8D-45C1-9D8C-45D566D69731}", 0);
    ::RegCloseKey(hKey);

    // Keep old ProgID as a compatibility alias.
    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"VerifySys.VerifyClient", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) == ERROR_SUCCESS) {
        ::RegSetValueW(hKey, nullptr, REG_SZ, L"QMPlugin Auth Compatibility Alias", 0);
        ::RegCloseKey(hKey);
    }
    if (::RegCreateKeyExW(HKEY_CLASSES_ROOT, L"VerifySys.VerifyClient\\CLSID", 0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) == ERROR_SUCCESS) {
        ::RegSetValueW(hKey, nullptr, REG_SZ, L"{8D83E26C-4A8D-45C1-9D8C-45D566D69731}", 0);
        ::RegCloseKey(hKey);
    }

    return S_OK;
}

// 反注册 COM
STDAPI DllUnregisterServer() {
    ::RegDeleteTreeW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth.1");
    ::RegDeleteTreeW(HKEY_CLASSES_ROOT, L"QMPlugin.Auth");
    ::RegDeleteTreeW(HKEY_CLASSES_ROOT, L"VerifySys.VerifyClient");
    ::RegDeleteTreeW(HKEY_CLASSES_ROOT, L"CLSID\\{8D83E26C-4A8D-45C1-9D8C-45D566D69731}");
    return S_OK;
}

// =====================================================================
// 业务方法实现
// =====================================================================

static long long NowMs() {
    FILETIME ft;
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER uli;
    uli.LowPart = ft.dwLowDateTime;
    uli.HighPart = ft.dwHighDateTime;
    return (long long)((uli.QuadPart - 116444736000000000ULL) / 10000ULL);
}

static std::wstring NewNonce() {
    GUID g;
    if (CoCreateGuid(&g) != S_OK) return std::to_wstring(NowMs());
    wchar_t buf[64];
    swprintf_s(buf, L"%08x%04x%04x%02x%02x%02x%02x%02x%02x%02x%02x",
        g.Data1, g.Data2, g.Data3,
        g.Data4[0], g.Data4[1], g.Data4[2], g.Data4[3],
        g.Data4[4], g.Data4[5], g.Data4[6], g.Data4[7]);
    return buf;
}

static std::wstring JsonPair(const std::wstring& key, const std::wstring& value) {
    return L"\"" + key + L"\":\"" + EscapeJsonString(value) + L"\"";
}

struct JsonField {
    std::wstring key;
    std::wstring value;
    bool isString;
};

static void AddExtraFields(const std::wstring& fragment, std::vector<JsonField>& fields) {
    size_t pos = 0;
    while (pos < fragment.size()) {
        pos = fragment.find(L'"', pos);
        if (pos == std::wstring::npos) break;
        size_t keyStart = ++pos;
        size_t keyEnd = fragment.find(L'"', keyStart);
        if (keyEnd == std::wstring::npos) break;
        std::wstring key = fragment.substr(keyStart, keyEnd - keyStart);
        pos = fragment.find(L':', keyEnd);
        if (pos == std::wstring::npos) break;
        pos++;
        while (pos < fragment.size() && iswspace(fragment[pos])) pos++;
        if (pos >= fragment.size()) break;
        if (fragment[pos] == L'"') {
            pos++;
            std::wstring value;
            bool esc = false;
            for (; pos < fragment.size(); pos++) {
                wchar_t c = fragment[pos];
                if (esc) {
                    value += c;
                    esc = false;
                } else if (c == L'\\') {
                    esc = true;
                } else if (c == L'"') {
                    pos++;
                    break;
                } else {
                    value += c;
                }
            }
            fields.push_back({ key, value, true });
        } else {
            size_t end = pos;
            while (end < fragment.size() && fragment[end] != L',') end++;
            fields.push_back({ key, fragment.substr(pos, end - pos), false });
            pos = end;
        }
    }
}

void VerifyClient::SetLastFailure(LONG code, const std::wstring& message, const std::wstring& raw) {
    m_lastStatus = 0;
    m_lastCode = code;
    m_lastMessage = message;
    m_lastError = message;
    if (!raw.empty()) m_lastResponse = raw;
}

std::wstring VerifyClient::BuildSignedBody(const std::wstring& path, const std::wstring& licenseCode, const std::wstring& extraJson) {
    if (m_machineCode.empty()) m_machineCode = GetMachineCodeInternal();
    const std::wstring timestamp = std::to_wstring(NowMs());
    const std::wstring nonce = NewNonce();

    std::vector<JsonField> fields;
    fields.push_back({ L"appId", m_appId, true });
    fields.push_back({ L"clientVersion", AUTH_PLUGIN_VERSION, true });
    if (!licenseCode.empty()) fields.push_back({ L"licenseCode", licenseCode, true });
    fields.push_back({ L"machineCode", m_machineCode, true });
    fields.push_back({ L"nonce", nonce, true });
    fields.push_back({ L"protocolVersion", L"1", false });
    fields.push_back({ L"timestamp", timestamp, false });
    AddExtraFields(extraJson, fields);
    std::sort(fields.begin(), fields.end(), [](const JsonField& a, const JsonField& b) {
        return a.key < b.key;
    });

    std::wstring bodyNoSign = L"{";
    for (size_t i = 0; i < fields.size(); i++) {
        if (i) bodyNoSign += L",";
        bodyNoSign += fields[i].isString ? JsonPair(fields[i].key, fields[i].value)
            : L"\"" + fields[i].key + L"\":" + fields[i].value;
    }
    bodyNoSign += L"}";

    if (m_secret.empty()) return bodyNoSign;

    std::wstring bodyHash = Sha256Hex(bodyNoSign);
    std::wstring material = L"POST\n" + path + L"\n" + m_appId + L"\n" + licenseCode + L"\n" + m_machineCode
        + L"\n" + timestamp + L"\n" + nonce + L"\n" + bodyHash;
    std::wstring sign = HmacSha256Hex(material, m_secret);

    std::wstring body = bodyNoSign;
    body.pop_back();
    body += L"," + JsonPair(L"sign", sign) + L"}";
    return body;
}

std::wstring VerifyClient::BuildSignedQuery(const std::wstring& path, const std::wstring& extraQuery) {
    std::wstring query = L"appId=" + UrlEncode(m_appId);
    if (!extraQuery.empty()) query += L"&" + extraQuery;
    return path + L"?" + query;
}

LONG VerifyClient::ApplyResponse(const std::wstring& response) {
    m_lastResponse = response;
    m_lastStatus = ExtractJsonSuccess(response) ? 1 : 0;
    m_lastCode = ExtractJsonLong(response, L"code", m_lastStatus ? 0 : -1);
    m_lastMessage = ExtractJsonString(response, L"message");
    if (m_lastMessage.empty()) m_lastMessage = ExtractJsonString(response, L"msg");
    if (m_lastMessage.empty()) m_lastMessage = m_lastStatus ? L"success" : L"request failed";
    m_lastError = m_lastStatus ? L"" : m_lastMessage;

    std::wstring sessionId = ExtractJsonString(response, L"sessionId");
    if (!sessionId.empty()) m_sessionId = sessionId;
    std::wstring token = ExtractJsonString(response, L"token");
    if (!token.empty()) m_sessionId = token;

    m_remainSeconds = ExtractJsonLong(response, L"remainSeconds", m_remainSeconds);
    m_expireTime = ExtractJsonString(response, L"expireAtText");
    if (m_expireTime.empty()) m_expireTime = ExtractJsonString(response, L"expireAt");
    m_licenseInfo = response;

    return m_lastStatus;
}

STDMETHODIMP VerifyClient::Init(BSTR serverUrl, BSTR appId, BSTR appSecret, LONG* pResult) {
    if (!pResult) return E_POINTER;
    SetServer(serverUrl, appId, pResult);
    SetSecret(appSecret, pResult);
    *pResult = 1;
    return S_OK;
}

STDMETHODIMP VerifyClient::SetServer(BSTR serverUrl, BSTR appId, LONG* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = BstrToWstr(serverUrl);
    if (!url.empty()) {
        while (!url.empty() && (url.back() == L'/' || url.back() == L'\\')) url.pop_back();
        if (url.size() >= 11 && url.rfind(L"/api/client") == url.size() - 11) m_apiBase = url;
        else m_apiBase = url + L"/api/client";
    }
    m_appId = BstrToWstr(appId);
    *pResult = 1;
    return S_OK;
}

STDMETHODIMP VerifyClient::SetSecret(BSTR appSecret, LONG* pResult) {
    if (!pResult) return E_POINTER;
    m_secret = BstrToWstr(appSecret);
    *pResult = 1;
    return S_OK;
}

STDMETHODIMP VerifyClient::SetTimeout(LONG timeoutMs, LONG* pResult) {
    if (!pResult) return E_POINTER;
    m_timeoutMs = timeoutMs < 1000 ? 1000 : timeoutMs;
    *pResult = 1;
    return S_OK;
}

STDMETHODIMP VerifyClient::SetIgnoreCertErrors(LONG flag, LONG* pResult) {
    if (!pResult) return E_POINTER;
    m_ignoreCertErrors = flag ? 1 : 0;
    *pResult = 1;
    return S_OK;
}

STDMETHODIMP VerifyClient::GetVersion(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(AUTH_PLUGIN_VERSION);
    return S_OK;
}

STDMETHODIMP VerifyClient::Verify(BSTR licenseCode, LONG* pResult) {
    if (!pResult) return E_POINTER;
    m_licenseCode = BstrToWstr(licenseCode);
    if (m_appId.empty() || m_licenseCode.empty()) {
        SetLastFailure(400, L"Init 或 licenseCode 参数不完整");
        *pResult = 0;
        return S_OK;
    }
    std::wstring body = BuildSignedBody(L"/api/client/verify", m_licenseCode);
    std::wstring response = HttpPost(m_apiBase + L"/verify", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::VerifyEx(BSTR serverUrl, BSTR appId, BSTR licenseCode, BSTR appSecret, LONG* pResult) {
    if (!pResult) return E_POINTER;
    Init(serverUrl, appId, appSecret, pResult);
    return Verify(licenseCode, pResult);
}

STDMETHODIMP VerifyClient::Bind(BSTR licenseCode, LONG* pResult) {
    return Verify(licenseCode, pResult);
}

STDMETHODIMP VerifyClient::UnbindEx(BSTR licenseCode, BSTR unbindPassword, LONG* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring code = BstrToWstr(licenseCode);
    std::wstring extra = JsonPair(L"unbindPassword", BstrToWstr(unbindPassword));
    std::wstring body = BuildSignedBody(L"/api/client/unbind", code, extra);
    std::wstring response = HttpPost(m_apiBase + L"/unbind", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetRemainSeconds(LONG* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = m_remainSeconds;
    return S_OK;
}

STDMETHODIMP VerifyClient::GetExpireTime(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(m_expireTime);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLicenseInfo(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(m_licenseInfo);
    return S_OK;
}

STDMETHODIMP VerifyClient::SetClientInfo(BSTR clientInfo, LONG* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring extra = JsonPair(L"clientInfo", BstrToWstr(clientInfo));
    std::wstring body = BuildSignedBody(L"/api/client/client-info", m_licenseCode, extra);
    std::wstring response = HttpPost(m_apiBase + L"/client-info", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::ReportEvent(BSTR name, BSTR message, LONG* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring extra = JsonPair(L"message", BstrToWstr(message)) + L"," + JsonPair(L"name", BstrToWstr(name));
    std::wstring body = BuildSignedBody(L"/api/client/report-event", m_licenseCode, extra);
    std::wstring response = HttpPost(m_apiBase + L"/report-event", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLastStatus(LONG* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = m_lastStatus;
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLastCode(LONG* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = m_lastCode;
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLastMessage(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(m_lastMessage);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLastError(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(m_lastError);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetLastResponse(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    *pResult = AllocResult(m_lastResponse);
    return S_OK;
}

STDMETHODIMP VerifyClient::Get_Plugin_Description(BSTR itemName, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring name = BstrToWstr(itemName);
    if (name.empty()) *pResult = AllocResult(L"远程网络验证");
    else if (_wcsicmp(name.c_str(), L"Init") == 0) *pResult = AllocResult(L"初始化验证服务器(serverUrl, appId, appSecret)");
    else if (_wcsicmp(name.c_str(), L"Verify") == 0) *pResult = AllocResult(L"验证注册码(licenseCode)");
    else if (_wcsicmp(name.c_str(), L"Heartbeat") == 0) *pResult = AllocResult(L"心跳保活()");
    else if (_wcsicmp(name.c_str(), L"GetMachineCode") == 0) *pResult = AllocResult(L"获取本机机器码()");
    else *pResult = AllocResult(L"Auth 网络验证接口");
    return S_OK;
}

STDMETHODIMP VerifyClient::Get_Plugin_Interpret_Template(BSTR itemName, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring name = BstrToWstr(itemName);
    if (_wcsicmp(name.c_str(), L"Init") == 0) *pResult = AllocResult(L"初始化验证服务器,地址$1,项目$2,密钥$3");
    else if (_wcsicmp(name.c_str(), L"Verify") == 0) *pResult = AllocResult(L"验证注册码$1");
    else if (_wcsicmp(name.c_str(), L"Heartbeat") == 0) *pResult = AllocResult(L"心跳保活");
    else if (_wcsicmp(name.c_str(), L"GetMachineCode") == 0) *pResult = AllocResult(L"获取本机机器码");
    else *pResult = AllocResult(L"");
    return S_OK;
}

STDMETHODIMP VerifyClient::Login(BSTR projectToken, BSTR regCode, BSTR machineCode, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + L"/login";
    std::wstring body = L"{\"projectToken\":\"" + BstrToWstr(projectToken)
        + L"\",\"code\":\"" + BstrToWstr(regCode)
        + L"\",\"machineCode\":\"" + BstrToWstr(machineCode) + L"\"}";
    *pResult = AllocResult(HttpPost(url, body));
    return S_OK;
}

STDMETHODIMP VerifyClient::Heartbeat(LONG* pResult) {
    if (!pResult) return E_POINTER;
    if (m_sessionId.empty()) {
        SetLastFailure(1012, L"无效会话");
        *pResult = 0;
        return S_OK;
    }
    std::wstring extra = JsonPair(L"sessionId", m_sessionId);
    std::wstring body = BuildSignedBody(L"/api/client/heartbeat", m_licenseCode, extra);
    std::wstring response = HttpPost(m_apiBase + L"/heartbeat", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::Logout(LONG* pResult) {
    if (!pResult) return E_POINTER;
    if (m_sessionId.empty()) {
        SetLastFailure(1012, L"无效会话");
        *pResult = 0;
        return S_OK;
    }
    std::wstring extra = JsonPair(L"sessionId", m_sessionId);
    std::wstring body = BuildSignedBody(L"/api/client/logout", m_licenseCode, extra);
    std::wstring response = HttpPost(m_apiBase + L"/logout", body);
    *pResult = ApplyResponse(response);
    if (*pResult == 1) m_sessionId.clear();
    return S_OK;
}

STDMETHODIMP VerifyClient::Unbind(BSTR projectToken, BSTR regCode, BSTR unbindPassword, BSTR machineCode, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + L"/unbind";
    std::wstring body = L"{\"projectToken\":\"" + BstrToWstr(projectToken)
        + L"\",\"code\":\"" + BstrToWstr(regCode)
        + L"\",\"unbindPassword\":\"" + BstrToWstr(unbindPassword)
        + L"\",\"machineCode\":\"" + BstrToWstr(machineCode) + L"\"}";
    *pResult = AllocResult(HttpPost(url, body));
    return S_OK;
}

STDMETHODIMP VerifyClient::GetMachineCode(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring mc = GetMachineCodeInternal();
    *pResult = AllocResult(mc);
    return S_OK;
}

STDMETHODIMP VerifyClient::GetPlacard(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + BuildSignedQuery(L"/placard");
    *pResult = AllocResult(HttpGet(url));
    return S_OK;
}

STDMETHODIMP VerifyClient::GetServerTime(BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + L"/server-time";
    *pResult = AllocResult(HttpGet(url));
    return S_OK;
}

STDMETHODIMP VerifyClient::SetApiBase(BSTR baseUrl) {
    m_apiBase = BstrToWstr(baseUrl);
    return S_OK;
}

STDMETHODIMP VerifyClient::TrialLogin(LONG* pResult) {
    if (!pResult) return E_POINTER;
    if (m_appId.empty()) {
        SetLastFailure(400, L"Init 参数不完整");
        *pResult = 0;
        return S_OK;
    }
    std::wstring body = BuildSignedBody(L"/api/client/trial-login", L"");
    std::wstring response = HttpPost(m_apiBase + L"/trial-login", body);
    *pResult = ApplyResponse(response);
    return S_OK;
}

STDMETHODIMP VerifyClient::Charge(BSTR regCode, BSTR cardCode, BSTR machineCode, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + L"/charge";
    std::wstring body = L"{\"code\":\"" + BstrToWstr(regCode)
        + L"\",\"cardCode\":\"" + BstrToWstr(cardCode)
        + L"\",\"machineCode\":\"" + BstrToWstr(machineCode) + L"\"}";
    *pResult = AllocResult(HttpPost(url, body));
    return S_OK;
}

STDMETHODIMP VerifyClient::GetCustomData(BSTR key, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + BuildSignedQuery(L"/custom-data", L"key=" + UrlEncode(BstrToWstr(key)));
    *pResult = AllocResult(HttpGet(url));
    return S_OK;
}

STDMETHODIMP VerifyClient::SetCustomData(BSTR projectToken, BSTR key, BSTR value, BSTR* pResult) {
    if (!pResult) return E_POINTER;
    std::wstring url = m_apiBase + L"/custom-data";
    std::wstring body = L"{\"projectToken\":\"" + BstrToWstr(projectToken)
        + L"\",\"key\":\"" + BstrToWstr(key)
        + L"\",\"value\":\"" + BstrToWstr(value) + L"\"}";
    *pResult = AllocResult(HttpPost(url, body));
    return S_OK;
}
