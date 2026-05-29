#ifndef VERIFY_COM_H
#define VERIFY_COM_H

#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0600
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif

#include "resource.h"
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <unknwn.h>
#include <olectl.h>
#include <string>

extern HMODULE g_hInst;

// {8D83E26C-4A8D-45C1-9D8C-45D566D69731}
DEFINE_GUID(CLSID_VerifyClient,
    0x8D83E26C, 0x4A8D, 0x45C1, 0x9D, 0x8C, 0x45, 0xD5, 0x66, 0xD6, 0x97, 0x31);

// {ED4F8B32-A73E-4D91-B5C7-8F3A1E2D6C90}
DEFINE_GUID(IID_IVerifyClient,
    0xED4F8B32, 0xA73E, 0x4D91, 0xB5, 0xC7, 0x8F, 0x3A, 0x1E, 0x2D, 0x6C, 0x90);

// {D7C9E3A0-5F12-4B86-A1D4-8E2B7F3C6D95}
DEFINE_GUID(LIBID_VerifyComLib,
    0xD7C9E3A0, 0x5F12, 0x4B86, 0xA1, 0xD4, 0x8E, 0x2B, 0x7F, 0x3C, 0x6D, 0x95);

// 默认 API 地址
#define DEFAULT_API_BASE L"http://127.0.0.1:3000/api/client"
#define AUTH_PLUGIN_VERSION L"0.2.0"

// ---- JSON 辅助 ----
std::wstring BuildJsonResult(bool success, int code, const std::wstring& message, const std::wstring& dataJson = L"null");
std::wstring BuildJsonResult(bool success, int code, const std::wstring& message, const std::wstring& dataJson);
std::wstring EscapeJsonString(const std::wstring& s);
std::wstring ExtractJsonString(const std::wstring& json, const std::wstring& key);
long ExtractJsonLong(const std::wstring& json, const std::wstring& key, long fallback = 0);
bool ExtractJsonSuccess(const std::wstring& json);
std::wstring Sha256Hex(const std::wstring& input);
std::wstring HmacSha256Hex(const std::wstring& material, const std::wstring& secret);
std::wstring UrlEncode(const std::wstring& input);

// ---- HTTP 请求 ----
std::wstring HttpPost(const std::wstring& url, const std::wstring& body);
std::wstring HttpGet(const std::wstring& url);

// ---- 机器码 ----
std::wstring GetMachineCodeInternal();

// ---- ATL 风格 COM 类（不依赖 ATL，纯 C++） ----
class VerifyClient : public IDispatch {
public:
    VerifyClient();
    ~VerifyClient();

    // IUnknown
    STDMETHOD(QueryInterface)(REFIID riid, void** ppv);
    STDMETHOD_(ULONG, AddRef)();
    STDMETHOD_(ULONG, Release)();

    // IDispatch
    STDMETHOD(GetTypeInfoCount)(UINT* pctinfo);
    STDMETHOD(GetTypeInfo)(UINT itinfo, LCID lcid, ITypeInfo** pptinfo);
    STDMETHOD(GetIDsOfNames)(REFIID riid, LPOLESTR* rgszNames, UINT cNames, LCID lcid, DISPID* rgdispid);
    STDMETHOD(Invoke)(DISPID dispidMember, REFIID riid, LCID lcid, WORD wFlags, DISPPARAMS* pdispparams, VARIANT* pvarResult, EXCEPINFO* pexcepinfo, UINT* puArgErr);

    // 业务方法
    STDMETHOD(Init)(BSTR serverUrl, BSTR appId, BSTR appSecret, LONG* pResult);
    STDMETHOD(SetServer)(BSTR serverUrl, BSTR appId, LONG* pResult);
    STDMETHOD(SetSecret)(BSTR appSecret, LONG* pResult);
    STDMETHOD(SetTimeout)(LONG timeoutMs, LONG* pResult);
    STDMETHOD(SetIgnoreCertErrors)(LONG flag, LONG* pResult);
    STDMETHOD(GetVersion)(BSTR* pResult);
    STDMETHOD(Verify)(BSTR licenseCode, LONG* pResult);
    STDMETHOD(VerifyEx)(BSTR serverUrl, BSTR appId, BSTR licenseCode, BSTR appSecret, LONG* pResult);
    STDMETHOD(Bind)(BSTR licenseCode, LONG* pResult);
    STDMETHOD(UnbindEx)(BSTR licenseCode, BSTR unbindPassword, LONG* pResult);
    STDMETHOD(GetRemainSeconds)(LONG* pResult);
    STDMETHOD(GetExpireTime)(BSTR* pResult);
    STDMETHOD(GetLicenseInfo)(BSTR* pResult);
    STDMETHOD(SetClientInfo)(BSTR clientInfo, LONG* pResult);
    STDMETHOD(ReportEvent)(BSTR name, BSTR message, LONG* pResult);
    STDMETHOD(GetLastStatus)(LONG* pResult);
    STDMETHOD(GetLastCode)(LONG* pResult);
    STDMETHOD(GetLastMessage)(BSTR* pResult);
    STDMETHOD(GetLastError)(BSTR* pResult);
    STDMETHOD(GetLastResponse)(BSTR* pResult);
    STDMETHOD(Get_Plugin_Description)(BSTR itemName, BSTR* pResult);
    STDMETHOD(Get_Plugin_Interpret_Template)(BSTR itemName, BSTR* pResult);

    // 兼容旧 VerifySys.VerifyClient 风格方法
    STDMETHOD(Login)(BSTR projectToken, BSTR regCode, BSTR machineCode, BSTR* pResult);
    STDMETHOD(Heartbeat)(LONG* pResult);
    STDMETHOD(Logout)(LONG* pResult);
    STDMETHOD(Unbind)(BSTR projectToken, BSTR regCode, BSTR unbindPassword, BSTR machineCode, BSTR* pResult);
    STDMETHOD(GetMachineCode)(BSTR* pResult);
    STDMETHOD(GetPlacard)(BSTR* pResult);
    STDMETHOD(GetServerTime)(BSTR* pResult);
    STDMETHOD(SetApiBase)(BSTR baseUrl);
    STDMETHOD(TrialLogin)(LONG* pResult);
    STDMETHOD(Charge)(BSTR regCode, BSTR cardCode, BSTR machineCode, BSTR* pResult);
    STDMETHOD(GetCustomData)(BSTR key, BSTR* pResult);
    STDMETHOD(SetCustomData)(BSTR projectToken, BSTR key, BSTR value, BSTR* pResult);

    // 类厂
    static HRESULT WINAPI CreateInstance(void* pCtx, REFIID riid, void** ppv);
    static HRESULT WINAPI Factory_CreateInstance(IClassFactory* pFac, IUnknown* pUnk, REFIID riid, void** ppv);
    static HRESULT WINAPI Factory_LockServer(IClassFactory* pFac, BOOL fLock);

private:
    std::wstring BuildSignedBody(const std::wstring& path, const std::wstring& licenseCode, const std::wstring& extraJson = L"");
    std::wstring BuildSignedQuery(const std::wstring& path, const std::wstring& extraQuery = L"");
    LONG ApplyResponse(const std::wstring& response);
    void SetLastFailure(LONG code, const std::wstring& message, const std::wstring& raw = L"");

    LONG m_cRef;
    std::wstring m_apiBase;
    std::wstring m_appId;
    std::wstring m_secret;
    std::wstring m_sessionId;
    std::wstring m_licenseCode;
    std::wstring m_machineCode;
    std::wstring m_lastResponse;
    std::wstring m_lastMessage;
    std::wstring m_lastError;
    std::wstring m_expireTime;
    std::wstring m_licenseInfo;
    LONG m_lastStatus;
    LONG m_lastCode;
    LONG m_remainSeconds;
    LONG m_timeoutMs;
    LONG m_ignoreCertErrors;
};

#endif // VERIFY_COM_H
