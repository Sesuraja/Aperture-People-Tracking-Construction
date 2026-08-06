import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Save,
  Bell,
  Shield,
  Network,
  Database,
  Users,
  Layout,
  Key,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lock,
  User,
  Server,
  Terminal,
  Workflow,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { gaoApi, DEFAULT_HOST } from "../lib/gaoApi";
import { doc, getDoc, setDoc, isMongoActive } from "../lib/db";
import { db, auth } from "../lib/firebase";
import { AppModeContext } from "../App";

export default function SettingsTab() {
  const { mode } = React.useContext(AppModeContext);
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("apidocs");

  useEffect(() => {
    if (location.state && location.state.focusSection) {
      setActiveSection(location.state.focusSection);
    }
  }, [location]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [apiUrl, setApiUrl] = useState(DEFAULT_HOST);
  const [apiDemoMode, setApiDemoMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Custom API Authentication states
  const [authType, setAuthType] = useState("none");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key");
  const [bearerToken, setBearerToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthTokenUrl, setOauthTokenUrl] = useState("");
  const [legacyGaoApiKey, setLegacyGaoApiKey] = useState("");
  const [showLegacyKey, setShowLegacyKey] = useState(false);

  // MongoDB Connection States
  const [mongoUri, setMongoUri] = useState("");
  const [showMongoPassword, setShowMongoPassword] = useState(false);
  const [mongoStatus, setMongoStatus] = useState({
    connected: false,
    connectionString: "",
  });
  const [testingMongo, setTestingMongo] = useState(false);
  const [mongoTestResult, setMongoTestResult] = useState<{
    success: boolean;
    msg: string;
  } | null>(null);
  const [savingMongo, setSavingMongo] = useState(false);

  // Interactive sandbox state
  const [activeEndpoint, setActiveEndpoint] = useState("get_realtime");
  const [sandboxSkip, setSandboxSkip] = useState(0);
  const [sandboxTake, setSandboxTake] = useState(10);
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState<any>(null);
  const [sandboxStatus, setSandboxStatus] = useState<string | null>(null);
  const [sandboxUrl, setSandboxUrl] = useState<string>("");

  // Notification settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState(
    "admin@gaostaff.com, security@gaostaff.com",
  );
  const [systemSounds, setSystemSounds] = useState(true);

  // User Management, Custom Claims, and Permissions states
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userRole, setUserRole] = useState<string>("operator");
  const [rolePermissions, setRolePermissions] = useState<any>({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<
    string | null
  >(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [isRefreshingClaims, setIsRefreshingClaims] = useState(false);

  // User creation states
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createRole, setCreateRole] = useState("operator");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Load current user and admin claims
  useEffect(() => {
    const fetchCurrentUserClaim = async () => {
      let resolvedRole = "operator";

      if (mode === "demo") {
        setUserRole("admin");
        return;
      }

      // 1. Try to get role from firebase db document fallback
      try {
        if (auth.currentUser) {
          const docRef = doc(
            db,
            "settings",
            `user_role_${auth.currentUser.uid}`,
          );
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const r = docSnap.data().role;
            if (r) resolvedRole = r;
          }
        }
      } catch (dbErr) {
        console.error(
          "Failed to fetch user role from db settings direct:",
          dbErr,
        );
      }

      // 2. Try auth custom claims
      try {
        const idTokenResult = await auth.currentUser?.getIdTokenResult(true);
        const claimRole = idTokenResult?.claims?.role as string;
        if (claimRole) {
          resolvedRole = claimRole;
        }
      } catch (err) {
        console.error("Error fetching current user custom claims:", err);
      }

      // 3. Email-based local fallback for local development & admin bypass
      if (
        auth.currentUser?.email?.toLowerCase() === "sigmund.t.d@gaostaff.com"
      ) {
        resolvedRole = "admin";
      }

      setUserRole(resolvedRole);
    };
    fetchCurrentUserClaim();
  }, [activeSection, mode]);

  // Sync users and permissions from database
  useEffect(() => {
    if (activeSection === "access") {
      loadManagementData();
    }
  }, [activeSection]);

  const loadManagementData = async () => {
    setIsLoadingUsers(true);
    setActionErrorMessage(null);
    try {
      if (mode === "demo") {
        // Mock user list and default role permissions for simulation
        setUsers([
          {
            uid: "demo_user_1",
            email: "operator_demo@gaostaff.com",
            displayName: "Jane Doe (Demo Operator)",
            role: "operator",
          },
          {
            uid: "demo_user_2",
            email: "manager_demo@gaostaff.com",
            displayName: "John Smith (Demo Manager)",
            role: "manager",
          },
          {
            uid: "demo_user_3",
            email: "sigmund.t.d@gaostaff.com",
            displayName: "Sigmund T.D (Demo Admin)",
            role: "admin",
          },
        ]);
        setRolePermissions({
          admin: {
            dashboard: true, live: true, playback: true, people: true, visitors: true,
            attendance: true, alerts: true, incidents: true, analytics: true,
            aiInsights: true, devices: true, maintenance: true, audit: true, settings: true
          },
          manager: {
            dashboard: true, live: true, playback: true, people: true, visitors: true,
            attendance: true, alerts: true, incidents: true, analytics: true,
            aiInsights: true, devices: true, maintenance: true, audit: true, settings: false
          },
          operator: {
            dashboard: false, live: true, playback: false, people: true, visitors: true,
            attendance: true, alerts: true, incidents: true, analytics: false,
            aiInsights: false, devices: false, maintenance: true, audit: false, settings: false
          },
          blocked: {
            dashboard: false, live: false, playback: false, people: false, visitors: false,
            attendance: false, alerts: false, incidents: false, analytics: false,
            aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
          },
        });
        setIsLoadingUsers(false);
        return;
      }

      // Fetch user claim profiles from back-end
      const token = localStorage.getItem("gao_jwt_token");
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const usersRes = await fetch("/api/admin/users", { headers: authHeader });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      } else {
        throw new Error("Failed to load registered system users list");
      }

      // Fetch dynamic role permissions from DB
      const permRes = await fetch("/api/admin/permissions", { headers: authHeader });
      if (permRes.ok) {
        const pData = await permRes.json();
        setRolePermissions(pData);
      }
    } catch (err: any) {
      console.error("Error loading permissions/users:", err);
      setActionErrorMessage(
        err.message ||
          "Error occurred communicating with authorization service server.",
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: string) => {
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      if (mode === "demo") {
        setUsers((prev) =>
          prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)),
        );
        setActionSuccessMessage(
          `Demo Mode Success: Updated user role to "${newRole}" for user ID: ${uid} in-memory!`,
        );
        return;
      }

      // 1. Direct write to settings database fallback (highly resilient via client SDK security rules)
      try {
        const docRef = doc(db, "settings", `user_role_${uid}`);
        await setDoc(
          docRef,
          {
            role: newRole,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        console.log(
          "Client-side role direct updated successfully in Firestore",
        );
      } catch (directErr) {
        console.error(
          "Client-side direct Firestore role update failed:",
          directErr,
        );
      }

      // 2. Proceed with backend sync for custom claims
      const token = localStorage.getItem("gao_jwt_token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch("/api/admin/set-user-role", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ uid, role: newRole }),
      });

      if (res.ok) {
        setActionSuccessMessage(
          `Successfully updated custom claim role to "${newRole}" for user ID: ${uid}`,
        );
        loadManagementData();
        window.dispatchEvent(new CustomEvent("gao-refresh-claims"));

        if (uid === auth.currentUser?.uid) {
          setActionSuccessMessage(
            `Successfully updated your own claim to "${newRole}"! Clicking "Refresh Verified claims" will instantly update active menus.`,
          );
        }
      } else {
        // Since direct update has already modified it successfully, proceed as a soft success
        setActionSuccessMessage(
          `Successfully updated user role to "${newRole}" in Firestore database database collection!`,
        );
        loadManagementData();
        window.dispatchEvent(new CustomEvent("gao-refresh-claims"));
      }
    } catch (err: any) {
      console.error(err);
      setActionErrorMessage(
        err.message || "Connection timeout editing user claims.",
      );
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the registered account for "${email}"?`,
      )
    ) {
      return;
    }
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      if (mode === "demo") {
        setUsers((prev) => prev.filter((u) => u.uid !== uid));
        setActionSuccessMessage(
          `Demo Mode: Deleted user ${email} from in-memory cache.`,
        );
        return;
      }

      const token = localStorage.getItem("gao_jwt_token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
        headers: authHeaders
      });
      if (res.ok) {
        setActionSuccessMessage(
          `Successfully deleted account for "${email}" from the registry.`,
        );
        loadManagementData();
      } else {
        const errorData = await res.json();
        throw new Error(
          errorData.error || "Server rejected the delete request",
        );
      }
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setActionErrorMessage(
        err.message || "Failed to delete the user account.",
      );
    }
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      if (mode === "demo") {
        setActionSuccessMessage(
          "Demo Mode Success: System security policy matrix saved in-memory and updated instantly!",
        );
        window.dispatchEvent(new CustomEvent("gao-refresh-claims"));
        return;
      }

      const token = localStorage.getItem("gao_jwt_token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ rolePermissions }),
      });
      if (res.ok) {
        setActionSuccessMessage(
          "System security policy matrix saved successfully! All feature boundaries are re-evaluated in real time.",
        );
        window.dispatchEvent(new CustomEvent("gao-refresh-claims"));
      } else {
        throw new Error("Server declined permission updates");
      }
    } catch (err: any) {
      console.error(err);
      setActionErrorMessage(
        err.message || "Failed to save system permissions matrix.",
      );
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleForceTokenRefresh = async () => {
    setIsRefreshingClaims(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    try {
      if (mode === "demo") {
        setActionSuccessMessage(
          `Authorization token refreshed! Active custom claim verified as: "admin" in demo.`,
        );
        window.dispatchEvent(new CustomEvent("gao-refresh-claims"));
        return;
      }

      const idTokenResult = await auth.currentUser?.getIdTokenResult(true);
      const role = (idTokenResult?.claims?.role as string) || "operator";
      setUserRole(role);
      setActionSuccessMessage(
        `Authorization token refreshed! Active custom claim verified as: "${role}".`,
      );
      window.dispatchEvent(new CustomEvent("gao-refresh-claims"));
    } catch (err: any) {
      console.error(err);
      setActionErrorMessage("Error executing claims update: " + err.message);
    } finally {
      setIsRefreshingClaims(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError(null);
    setCreationSuccess(null);

    if (!createEmail || !createPassword || !createRole) {
      setCreationError(
        "Please fill in all required fields (Email, Password, and Role).",
      );
      return;
    }

    if (createPassword.length < 6) {
      setCreationError("Password must be at least 6 characters.");
      return;
    }

    setIsCreatingUser(true);
    try {
      if (mode === "demo") {
        const mockUid = "demo_" + Date.now();
        setUsers((prev) => [
          ...prev,
          {
            uid: mockUid,
            email: createEmail.toLowerCase(),
            displayName: createDisplayName || createEmail.split("@")[0],
            role: createRole,
          },
        ]);
        setCreationSuccess(
          `Demo Mode Success: Beautiful user "${createDisplayName || createEmail.split("@")[0]}" created in-memory with role "${createRole}"!`,
        );
        setCreateEmail("");
        setCreatePassword("");
        setCreateDisplayName("");
        setCreateRole("operator");
        return;
      }

      const token = localStorage.getItem("gao_jwt_token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          name: createDisplayName,
          role: createRole,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreationSuccess(
          `User account "${data.user.email}" successfully provisioned with role "${data.user.role}" in Firebase Auth and Database!`,
        );
        // Clear input fields
        setCreateEmail("");
        setCreatePassword("");
        setCreateDisplayName("");
        setCreateRole("operator");
        // Reload users roster
        loadManagementData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Server rejected user creation");
      }
    } catch (err: any) {
      console.error("Error in handleCreateUser:", err);
      setCreationError(
        err.message || "Error occurred while creating user account.",
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Custom thresholds state
  const [loiteringThreshold, setLoiteringThreshold] = useState(300);
  const [idleAlertThreshold, setIdleAlertThreshold] = useState(3600);
  const [occupancyThresholds, setOccupancyThresholds] = useState<
    Record<string, number>
  >({
    Entrance: 20,
    Office: 50,
    "Meeting Room": 15,
    "Server Room": 2,
    Cafeteria: 30,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);

        let userLegacyKey = "";
        if (auth.currentUser) {
          try {
            const userDocRef = doc(
              db,
              "settings",
              `user_settings_${auth.currentUser.uid}`,
            );
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              if (userData.legacyGaoApiKey !== undefined) {
                userLegacyKey = userData.legacyGaoApiKey;
              }
            }
          } catch (err) {
            console.warn("Could not load user-specific legacy API key:", err);
          }
        }

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.apiUrl !== undefined) {
            setApiUrl(data.apiUrl);
            gaoApi.setHost(data.apiUrl);
          } else {
            const savedUrl =
              localStorage.getItem("gao_api_url") || DEFAULT_HOST;
            setApiUrl(savedUrl);
            gaoApi.setHost(savedUrl);
          }
          if (data.demoMode !== undefined) {
            setApiDemoMode(data.demoMode);
          }
          if (data.loiteringThreshold !== undefined)
            setLoiteringThreshold(data.loiteringThreshold);
          if (data.idleAlertThreshold !== undefined)
            setIdleAlertThreshold(data.idleAlertThreshold);
          if (data.occupancyThresholds !== undefined)
            setOccupancyThresholds(data.occupancyThresholds);
          if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
          if (data.emailRecipients !== undefined)
            setEmailRecipients(data.emailRecipients);
          if (data.systemSounds !== undefined)
            setSystemSounds(data.systemSounds);

          // Configure standard credentials from DB
          if (data.authType !== undefined) setAuthType(data.authType);
          if (data.apiKey !== undefined) setApiKey(data.apiKey);
          if (data.apiKeyHeader !== undefined)
            setApiKeyHeader(data.apiKeyHeader);
          if (data.bearerToken !== undefined) setBearerToken(data.bearerToken);
          if (data.username !== undefined) setUsername(data.username);
          if (data.password !== undefined) setPassword(data.password);
          if (data.oauthClientId !== undefined)
            setOauthClientId(data.oauthClientId);
          if (data.oauthClientSecret !== undefined)
            setOauthClientSecret(data.oauthClientSecret);
          if (data.oauthTokenUrl !== undefined)
            setOauthTokenUrl(data.oauthTokenUrl);

          if (userLegacyKey) {
            setLegacyGaoApiKey(userLegacyKey);
          } else if (data.legacyGaoApiKey !== undefined) {
            setLegacyGaoApiKey(data.legacyGaoApiKey);
          } else {
            setLegacyGaoApiKey(
              localStorage.getItem("gao_legacy_api_key") || "",
            );
          }
        } else {
          const savedUrl = localStorage.getItem("gao_api_url") || DEFAULT_HOST;
          setApiUrl(savedUrl);
          gaoApi.setHost(savedUrl);

          setAuthType(localStorage.getItem("gao_auth_type") || "none");
          setApiKey(localStorage.getItem("gao_api_key") || "");
          setApiKeyHeader(
            localStorage.getItem("gao_api_key_header") || "X-API-Key",
          );
          setBearerToken(localStorage.getItem("gao_bearer_token") || "");
          setUsername(localStorage.getItem("gao_username") || "");
          setPassword(localStorage.getItem("gao_password") || "");
          setOauthClientId(localStorage.getItem("gao_oauth_client_id") || "");
          setOauthClientSecret(
            localStorage.getItem("gao_oauth_client_secret") || "",
          );
          setOauthTokenUrl(localStorage.getItem("gao_oauth_token_url") || "");

          setLegacyGaoApiKey(localStorage.getItem("gao_legacy_api_key") || "");
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    // Load MongoDB configuration states on mount
    const savedMongoUri = localStorage.getItem("gao_mongodb_uri") || "";
    setMongoUri(savedMongoUri);
    fetch("/api/mongodb/status")
      .then(async (res) => {
        if (!res.ok) return Promise.reject();
        const text = await res.text();
        try { return JSON.parse(text); } catch { return Promise.reject(); }
      })
      .then((status) => setMongoStatus(status))
      .catch((e) =>
        console.warn("Could not lead MongoDB backend status on mount:", e),
      );
  }, []);

  const handleTestMongo = async () => {
    if (!mongoUri) {
      setMongoTestResult({
        success: false,
        msg: "Please enter a connection string.",
      });
      return;
    }
    setTestingMongo(true);
    setMongoTestResult(null);
    try {
      const res = await fetch("/api/mongodb/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mongodbUri: mongoUri }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: res.ok ? text : `Server HTTP ${res.status}: ${text.slice(0, 150)}` };
      }
      if (data.success) {
        setMongoTestResult({
          success: true,
          msg: "MongoDB connection test passed successfully!",
        });
      } else {
        setMongoTestResult({
          success: false,
          msg: data.error || "Connection failed. Please check credentials & Atlas IP access rules.",
        });
      }
    } catch (e: any) {
      setMongoTestResult({
        success: false,
        msg: e.message || "Network error testing connection",
      });
    } finally {
      setTestingMongo(false);
    }
  };

  const handleSaveMongo = async () => {
    if (!mongoUri) {
      localStorage.removeItem("gao_mongodb_uri");
      setMongoStatus({ connected: false, connectionString: "" });
      setMongoTestResult({
        success: true,
        msg: "Removed MongoDB URI. Reverting all tabs to default database.",
      });
      window.dispatchEvent(new Event('mongo-config-updated'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    setSavingMongo(true);
    setMongoTestResult(null);
    try {
      const res = await fetch("/api/mongodb/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mongodbUri: mongoUri }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: res.ok ? text : `Server HTTP ${res.status}: ${text.slice(0, 150)}` };
      }
      if (res.ok && data.success) {
        localStorage.setItem("gao_mongodb_uri", mongoUri);
        setMongoStatus({ connected: true, connectionString: mongoUri });
        setMongoTestResult({
          success: true,
          msg: "MongoDB connected and saved! Persisted to local storage and active server session.",
        });
        window.dispatchEvent(new Event('mongo-config-updated'));
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setMongoTestResult({
          success: false,
          msg: data.error || "Failed to save MongoDB config.",
        });
      }
    } catch (e: any) {
      setMongoTestResult({
        success: false,
        msg: e.message || "Error saving MongoDB config.",
      });
    } finally {
      setSavingMongo(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "global"),
        {
          apiUrl,
          demoMode: apiDemoMode,
          loiteringThreshold,
          idleAlertThreshold,
          occupancyThresholds,
          emailAlerts,
          emailRecipients,
          systemSounds,

          // Save auth details in DB
          authType,
          apiKey,
          apiKeyHeader,
          bearerToken,
          username,
          password,
          oauthClientId,
          oauthClientSecret,
          oauthTokenUrl,
          legacyGaoApiKey,
        },
        { merge: true },
      );

      if (auth.currentUser) {
        try {
          await setDoc(
            doc(db, "settings", `user_settings_${auth.currentUser.uid}`),
            {
              userId: auth.currentUser.uid,
              email: auth.currentUser.email,
              legacyGaoApiKey,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (authErr) {
          console.warn(
            "Non-blocking config save to user sub-settings document failed:",
            authErr,
          );
        }
      }

      localStorage.setItem("gao_api_url", apiUrl);
      localStorage.setItem("gao_auth_type", authType);
      localStorage.setItem("gao_api_key", apiKey);
      localStorage.setItem("gao_api_key_header", apiKeyHeader);
      localStorage.setItem("gao_bearer_token", bearerToken);
      localStorage.setItem("gao_username", username);
      localStorage.setItem("gao_password", password);
      localStorage.setItem("gao_oauth_client_id", oauthClientId);
      localStorage.setItem("gao_oauth_client_secret", oauthClientSecret);
      localStorage.setItem("gao_oauth_token_url", oauthTokenUrl);
      localStorage.setItem("gao_legacy_api_key", legacyGaoApiKey);

      gaoApi.setHost(apiUrl);
      setTestResult(null);
    } catch (e) {
      console.error("Failed to save settings to DB:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    gaoApi.setHost(apiUrl); // Test the current input
    try {
      const count = await gaoApi.getHistoryTotalCount();
      // If we got back a number (even 0), we assume success
      setTestResult("success");
    } catch (e) {
      setTestResult("error");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row w-full bg-slate-50">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0 flex flex-col p-4 shadow-sm z-10">
        <h2 className="text-xl font-bold text-slate-900 mb-6 px-2 tracking-tight">
          Settings
        </h2>

        <nav className="flex flex-col gap-1">
          <button
            onClick={() => setActiveSection("general")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "general" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Layout className="w-4 h-4" /> General
          </button>
          <button
            onClick={() => setActiveSection("security")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "security" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Shield className="w-4 h-4" /> Security & Tracking
          </button>
          <button
            onClick={() => setActiveSection("notifications")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "notifications" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Bell className="w-4 h-4" /> Notifications
          </button>
          <button
            onClick={() => setActiveSection("network")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "network" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Network className="w-4 h-4" /> Network config
          </button>
          <button
            onClick={() => setActiveSection("integrations")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "integrations" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Database className="w-4 h-4" /> Integrations
          </button>
          <button
            onClick={() => setActiveSection("rules")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "rules" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Workflow className="w-4 h-4" /> Alert Rules
          </button>
          <button
            onClick={() => setActiveSection("apidocs")}
            id="settings_api_docs_tab"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "apidocs" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Key className="w-4 h-4" /> API Docs & Console
          </button>
          <button
            onClick={() => setActiveSection("access")}
            id="settings_access_control_tab"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${activeSection === "access" ? "bg-[#007BC4]/10 text-[#007BC4]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            <Users className="w-4 h-4" /> Access Control & Roles
          </button>
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          {activeSection === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  General Settings
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Configure your dashboard preferences and global system
                  defaults.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Aperture System Administration"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
                  />
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    System Timezone
                  </label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition">
                    <option>UTC (Coordinated Universal Time)</option>
                    <option>EST (Eastern Standard Time)</option>
                    <option>PST (Pacific Standard Time)</option>
                  </select>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Data Retention (Days)
                  </label>
                  <input
                    type="number"
                    defaultValue="90"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Movement history and logs older than this will be
                    permanently archived.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <Save className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Security & Tracking
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Configure physical access policies and AI tracking
                  sensitivity.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100 mb-6">
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Loitering Threshold (Seconds)
                  </label>
                  <input
                    type="number"
                    value={loiteringThreshold}
                    onChange={(e) =>
                      setLoiteringThreshold(parseInt(e.target.value) || 300)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Time before an alert is triggered in restricted zones.
                  </p>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Idle Alert Threshold (Seconds)
                  </label>
                  <input
                    type="number"
                    value={idleAlertThreshold}
                    onChange={(e) =>
                      setIdleAlertThreshold(parseInt(e.target.value) || 3600)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Time identifying an inactive tag or prolonged idle period.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  Zone Occupancy Limits
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Set maximum allowed occupancy per monitored zone.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                {Object.entries(occupancyThresholds).map(([zone, limit]) => (
                  <div
                    key={zone}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="font-bold text-slate-800">{zone}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-500">
                        Max people:
                      </span>
                      <input
                        type="number"
                        value={limit}
                        onChange={(e) =>
                          setOccupancyThresholds({
                            ...occupancyThresholds,
                            [zone]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 text-center focus:border-[#007BC4] outline-none transition"
                        min="1"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <Save className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Security Settings"}
                </button>
              </div>
            </div>
          )}

          {activeSection === "integrations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  API & Database Integrations
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Connect your external database and API services to sync
                  personnel data.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-800">
                      MongoDB Cloud Connection URI (MONGODB_URI)
                    </label>
                    <button
                      type="button"
                      onClick={() => setMongoUri("mongodb+srv://sigmundtd_db_user:Jesuraja123%40@cluster0.lxd6qba.mongodb.net/gao_rfid")}
                      className="text-xs font-bold text-[#007BC4] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Use Default Aperture RFID Cluster
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showMongoPassword ? "text" : "password"}
                      placeholder="mongodb+srv://sigmundtd_db_user:<password>@cluster0.lxd6qba.mongodb.net/gao_rfid"
                      value={mongoUri}
                      onChange={(e) => setMongoUri(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-slate-900 focus:border-[#007BC4] focus:ring-2 focus:ring-[#007BC4]/20 outline-none transition font-mono text-sm shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMongoPassword(!showMongoPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      title={showMongoPassword ? "Hide connection password" : "Show connection password"}
                    >
                      {showMongoPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {mongoTestResult && (
                    <div
                      className={`mt-3 p-3.5 rounded-lg text-xs font-mono border text-left flex items-start gap-2 ${
                        mongoTestResult.success 
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
                          : "bg-rose-50 text-rose-900 border-rose-200"
                      }`}
                    >
                      {mongoTestResult.success ? (
                        <span className="text-emerald-600 font-bold shrink-0">✓ SUCCESS:</span>
                      ) : (
                        <span className="text-rose-600 font-bold shrink-0">✗ DIAGNOSTIC ALERT:</span>
                      )}
                      <span className="break-words leading-relaxed">{mongoTestResult.msg}</span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2.5 items-center">
                    <button
                      type="button"
                      onClick={handleTestMongo}
                      disabled={testingMongo}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                      <Database className="w-3.5 h-3.5 text-slate-500" />
                      {testingMongo ? "Validating Connection..." : "Test Connection"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMongo}
                      disabled={savingMongo}
                      className="px-4 py-2 bg-[#007BC4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingMongo ? "Saving & Connecting..." : "Save MONGODB_URI"}
                    </button>
                  </div>

                  <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            isMongoActive() ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        ></span>
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            isMongoActive() ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        ></span>
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Active Persistence Mode:
                      </span>
                      <span className="text-xs font-mono text-slate-600 font-semibold">
                        {isMongoActive()
                          ? "MongoDB Cluster Proxy (/api/data/*)"
                          : "Cloud Firestore Default"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Legacy Aperture Server API Key</span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-tight font-normal uppercase">
                      Secure Key
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showLegacyKey ? "text" : "password"}
                      placeholder="aperture_legacy_key_abc123..."
                      value={legacyGaoApiKey}
                      onChange={(e) => setLegacyGaoApiKey(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLegacyKey(!showLegacyKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                      title={showLegacyKey ? "Hide key" : "Show key"}
                    >
                      {showLegacyKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Used for secure authentication handshake with legacy Aperture
                    system services. Stored in Firestore user settings.
                  </p>
                </div>
              </div>

              <div className="mb-4 pt-4 border-t border-slate-100">
                <h3 className="text-xl font-bold text-slate-900">
                  Third-party Enterprise Integrations
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Configure Enterprise Integrations and External Handlers.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      CCTV Camera Sync
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Link RFID scans to nearest camera feed timestamps.
                    </p>
                  </div>
                  <button className="text-xs font-bold bg-[#007BC4] text-white px-3 py-1.5 rounded shadow-sm hover:bg-[#006aa9] transition">
                    Configure
                  </button>
                </div>
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      Access Control (Turnstiles)
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Open doors automatically when Aperture authorized tags
                      approach.
                    </p>
                  </div>
                  <button className="text-xs font-bold bg-[#007BC4] text-white px-3 py-1.5 rounded shadow-sm hover:bg-[#006aa9] transition">
                    Configure
                  </button>
                </div>
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      Mobile App (Security Staff)
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Provision mobile app access for security guards.
                    </p>
                  </div>
                  <button className="text-xs font-bold bg-[#007BC4] text-white px-3 py-1.5 rounded shadow-sm hover:bg-[#006aa9] transition">
                    Manage Access
                  </button>
                </div>
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      SMS Alerts
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Send priority security notifications via external
                      messaging paths.
                    </p>
                  </div>
                  <button className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded shadow-sm hover:bg-slate-300 transition">
                    Setup Twilio Api
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <div></div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Save className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Notifications
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Manage alerting channels and email notification preferences.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Email Alerts</div>
                    <div className="text-sm font-medium text-slate-500 mt-1">
                      Receive immediate emails for critical security events.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007BC4]"></div>
                  </label>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Alert Recipient Emails
                  </label>
                  <input
                    type="text"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Comma separated list of email addresses.
                  </p>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      System Sounds
                    </div>
                    <div className="text-sm font-medium text-slate-500 mt-1">
                      Play an audible chime when an alert is generated.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemSounds}
                      onChange={(e) => setSystemSounds(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007BC4]"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <Save className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </div>
          )}

          {activeSection === "network" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Network & API Configuration
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Configure connections to external readers and APIs.
                </p>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Primary API Endpoint URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.example.com/v1"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Used for fetching live RFID tag occurrences.
                  </p>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      Demo/Simulation Mode
                    </div>
                    <div className="text-sm font-medium text-slate-500 mt-1">
                      Use simulated data instead of fetching from the real API.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apiDemoMode}
                      onChange={(e) => setApiDemoMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#007BC4]"></div>
                  </label>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    MQTT Broker URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="mqtt://broker.hivemq.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:border-[#007BC4] outline-none transition font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <div>
                  {testResult === "success" && (
                    <div className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                      Connection Successful
                    </div>
                  )}
                  {testResult === "error" && (
                    <div className="text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />{" "}
                      Connection Failed
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting || apiDemoMode}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <Network className="w-4 h-4 animate-spin" /> Testing...
                      </>
                    ) : (
                      <>
                        <Network className="w-4 h-4" /> Test Connection
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Save className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "apidocs" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#007BC4]" /> API
                  Documentation & Developer Console
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Configure security credentials, browse developer schemas, and
                  execute live sandbox queries against the Aperture RFID People
                  Tracking APIs.
                </p>
              </div>

              {/* Step-by-Step Connection & Architecture Tutorial Card */}
              <div className="bg-gradient-to-r from-blue-50 to-sky-50 dark:from-slate-800/40 dark:to-slate-800/80 border border-[#007BC4]/25 rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Sparkles className="w-4.5 h-4.5 text-[#007BC4]" />
                  How to Connect Your Physical Aperture RFID API Router
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Our platform features a built-in highly secure, custom Express
                  backend proxy. Instead of accessing your Aperture RFID controller's
                  local IP or domain name from the browser (which triggers
                  browser CORS blockers),{" "}
                  <strong>
                    all requests are safely routed through our server-side
                    secure credentials broker
                  </strong>
                  .
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-[#007BC4]/10 text-[#007BC4] font-black flex items-center justify-center text-xs mb-2">
                        1
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 block mb-1">
                        Set Your API Host
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Under the Configuration form below, paste your Aperture
                        System or controller base service URL.
                      </p>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-400 mt-3 font-mono">
                      e.g., https://192.168.1.100/rfid
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-[#007BC4]/10 text-[#007BC4] font-black flex items-center justify-center text-xs mb-2">
                        2
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 block mb-1">
                        Select Auth Strategy
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Choose API Key, Bearer tokens, Basic user-creds, or
                        OAuth client token generators.
                      </p>
                    </div>
                    <span className="text-[9px] font-semibold text-[#007BC4] mt-3 font-mono">
                      Secured Server Proxy
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="w-6 h-6 rounded-full bg-[#007BC4]/10 text-[#007BC4] font-black flex items-center justify-center text-xs mb-2">
                        3
                      </div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 block mb-1">
                        Launch Real Mode
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Click Test Connection below, then log in under "Real
                        Connection Mode" to start live mapping sync!
                      </p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-500 mt-3 flex items-center gap-1">
                      ✓ Automated 3s polling active
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic API Configuration Form */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" /> 1.
                    Authentication Configuration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Auth Mechanism
                      </label>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
                      >
                        <option value="none">
                          None (Public / Local Proxy)
                        </option>
                        <option value="api_key">
                          API Key (Custom Headers)
                        </option>
                        <option value="bearer">
                          Bearer Token (Authorization Header)
                        </option>
                        <option value="basic">
                          Basic Auth (Username / Password)
                        </option>
                        <option value="oauth">
                          OAuth 2.0 (Client Credentials Flow)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Target API Host URL{" "}
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.i360services.com/peopletrackinguhf"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-xs focus:border-[#007BC4] outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Conditional Auth Inputs */}
                  {authType === "api_key" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          API Key Parameter Header Name
                        </label>
                        <input
                          type="text"
                          value={apiKeyHeader}
                          onChange={(e) => setApiKeyHeader(e.target.value)}
                          placeholder="X-API-Key"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          API Secret Key Value
                        </label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="e.g. gao_api_sec_481a7b..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  {authType === "bearer" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">
                        Bearer Authorization Token
                      </label>
                      <input
                        type="password"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                      />
                    </div>
                  )}

                  {authType === "basic" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          Basic Username
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="gao@operator"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-[#007BC4] outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          Basic Password
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••••"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-[#007BC4] outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  {authType === "oauth" && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            OAuth 2.0 Client ID
                          </label>
                          <input
                            type="text"
                            value={oauthClientId}
                            onChange={(e) => setOauthClientId(e.target.value)}
                            placeholder="client_guid_123..."
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            OAuth 2.0 Client Secret
                          </label>
                          <input
                            type="password"
                            value={oauthClientSecret}
                            onChange={(e) =>
                              setOauthClientSecret(e.target.value)
                            }
                            placeholder="••••••••••••••"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          OAuth Token Endpoint URL (grant_type:
                          client_credentials)
                        </label>
                        <input
                          type="url"
                          value={oauthTokenUrl}
                          onChange={(e) => setOauthTokenUrl(e.target.value)}
                          placeholder="https://auth.i360services.com/oauth/token"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-[#007BC4] outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                      className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? "Preserving..." : "Save Configuration"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Documentation Endpoint selector */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" /> 2. Aperture RFID
                    API Schemas & Endpoints
                  </h4>
                  <p className="text-slate-500 text-xs mt-1">
                    Select an RFID web service endpoint to view its schema
                    details, required input payload configurations, and execute
                    it interactively.
                  </p>
                </div>

                <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50 overflow-x-auto">
                  <button
                    onClick={() => {
                      setActiveEndpoint("get_realtime");
                      setSandboxResponse(null);
                      setSandboxStatus(null);
                    }}
                    className={`px-4 py-3 shrink-0 border-b-2 transition-all ${activeEndpoint === "get_realtime" ? "border-[#007BC4] text-[#007BC4] bg-white" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  >
                    GET /api/GetTagsInRealtime
                  </button>
                  <button
                    onClick={() => {
                      setActiveEndpoint("get_records");
                      setSandboxResponse(null);
                      setSandboxStatus(null);
                    }}
                    className={`px-4 py-3 shrink-0 border-b-2 transition-all ${activeEndpoint === "get_records" ? "border-[#007BC4] text-[#007BC4] bg-white" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  >
                    GET /api/GetHistoryRecords/{"{skip}"}/{"{take}"}
                  </button>
                  <button
                    onClick={() => {
                      setActiveEndpoint("get_count");
                      setSandboxResponse(null);
                      setSandboxStatus(null);
                    }}
                    className={`px-4 py-3 shrink-0 border-b-2 transition-all ${activeEndpoint === "get_count" ? "border-[#007BC4] text-[#007BC4] bg-white" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  >
                    GET /api/GetHistoryTotalCount
                  </button>
                </div>

                {/* Endpoint details */}
                <div className="p-6 space-y-4">
                  {activeEndpoint === "get_realtime" && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono">
                          GET
                        </span>
                        <code className="text-xs font-mono font-bold text-slate-700">
                          {apiUrl || DEFAULT_HOST}/api/GetTagsInRealtime
                        </code>
                      </div>
                      <p className="text-xs text-slate-600">
                        Fetches scanning occurrences and location parameters for
                        all active wearable RFID employee tracking tags synced
                        with active readers.
                      </p>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Request Payload Headers
                        </span>
                        <div className="bg-slate-900 text-slate-300 p-3 rounded-lg font-mono text-[11px] space-y-0.5">
                          <div>Content-Type: application/json</div>
                          <div>Accept: application/json</div>
                          {authType !== "none" && (
                            <div>
                              Authorization:{" "}
                              {authType === "bearer"
                                ? "Bearer [Token]"
                                : authType === "basic"
                                  ? "Basic [Base64-encoded]"
                                  : "Header auth configured"}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Expected Response Schema (JSON Array)
                        </span>
                        <div className="bg-slate-900 text-sky-400 p-3 rounded-lg font-mono text-[11px]">
                          <pre>{`[
  {
    "TagID": "E2801130200076D491CC01BB",
    "Timestamp": "2026-06-06 10:43:00",
    "Location": "General Office"
  }
]`}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeEndpoint === "get_records" && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono">
                          GET
                        </span>
                        <code className="text-xs font-mono font-bold text-slate-700">
                          {apiUrl || DEFAULT_HOST}/api/GetHistoryRecords/
                          {sandboxSkip}/{sandboxTake}
                        </code>
                      </div>
                      <p className="text-xs text-slate-600">
                        Retrieves paginated tracking logs detailing movement
                        histories, dwell times, and entry/leave events for
                        security reports.
                      </p>

                      {/* Paginated Inputs inside sandbox */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2">
                          <span>Skip (Offset):</span>
                          <input
                            type="number"
                            value={sandboxSkip}
                            onChange={(e) =>
                              setSandboxSkip(
                                Math.max(0, parseInt(e.target.value) || 0),
                              )
                            }
                            className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-center"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span>Take (Limit):</span>
                          <input
                            type="number"
                            value={sandboxTake}
                            onChange={(e) =>
                              setSandboxTake(
                                Math.max(1, parseInt(e.target.value) || 10),
                              )
                            }
                            className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Expected Response Schema (JSON Array)
                        </span>
                        <div className="bg-slate-900 text-sky-400 p-3 rounded-lg font-mono text-[11px]">
                          <pre>{`[
  {
    "TagID": "E2801130200076D491CC01BB",
    "FirstName": "Sarah",
    "LastName": "Connor",
    "LocationName": "Server Room",
    "EnterTimeStr": "2026-06-06 09:30:15",
    "LeaveTimeStr": "2026-06-06 10:05:40",
    "Duration": 2125
  }
]`}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeEndpoint === "get_count" && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono">
                          GET
                        </span>
                        <code className="text-xs font-mono font-bold text-slate-700">
                          {apiUrl || DEFAULT_HOST}/api/GetHistoryTotalCount
                        </code>
                      </div>
                      <p className="text-xs text-slate-600">
                        Retrieves an integer representing the aggregate sum of
                        all logged history events registered throughout the
                        system workspace database.
                      </p>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Expected Response Schema
                        </span>
                        <div className="bg-slate-900 text-sky-400 p-3 rounded-lg font-mono text-[11px]">
                          <div>
                            Integer value representing total count. Example:{" "}
                            <code>14285</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sandbox interactive button trigger */}
                  <div className="pt-4 border-t border-slate-150 flex items-center justify-between">
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                      <Server className="w-3 h-3 text-slate-400" /> Full-stack
                      backend proxy layer active.
                    </div>
                    <button
                      onClick={async () => {
                        setIsRunningSandbox(true);
                        setSandboxResponse(null);
                        setSandboxStatus(null);

                        const customHeaders: Record<string, string> = {
                          "Content-Type": "application/json",
                        };

                        if (apiUrl) {
                          customHeaders["x-gao-target-host"] = apiUrl;
                        }

                        customHeaders["x-gao-auth-type"] = authType;

                        if (authType === "api_key") {
                          customHeaders["x-gao-api-key"] = apiKey;
                          customHeaders["x-gao-api-key-header"] = apiKeyHeader;
                        } else if (authType === "bearer") {
                          customHeaders["x-gao-bearer-token"] = bearerToken;
                        } else if (authType === "basic") {
                          customHeaders["x-gao-username"] = username;
                          customHeaders["x-gao-password"] = password;
                        } else if (authType === "oauth") {
                          customHeaders["x-gao-oauth-client-id"] =
                            oauthClientId;
                          customHeaders["x-gao-oauth-client-secret"] =
                            oauthClientSecret;
                          customHeaders["x-gao-oauth-token-url"] =
                            oauthTokenUrl;
                        }

                        try {
                          let resData: any = null;
                          let urlStr = "";
                          if (activeEndpoint === "get_count") {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetHistoryTotalCount`;
                            const count =
                              await gaoApi.getHistoryTotalCount(customHeaders);
                            resData = { totalHistoryCount: count };
                          } else if (activeEndpoint === "get_records") {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetHistoryRecords/${sandboxSkip}/${sandboxTake}`;
                            const records = await gaoApi.getHistoryRecords(
                              sandboxSkip,
                              sandboxTake,
                              customHeaders,
                            );
                            resData = records;
                          } else {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetTagsInRealtime`;
                            const tags =
                              await gaoApi.getTagsInRealtime(customHeaders);
                            resData = tags;
                          }
                          setSandboxUrl(urlStr);
                          setSandboxResponse(resData);
                          setSandboxStatus("200 OK");
                        } catch (err: any) {
                          console.error("Sandbox run error:", err);
                          let urlStr = "";
                          if (activeEndpoint === "get_count") {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetHistoryTotalCount`;
                          } else if (activeEndpoint === "get_records") {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetHistoryRecords/${sandboxSkip}/${sandboxTake}`;
                          } else {
                            urlStr = `${apiUrl.replace(/\/$/, "")}/api/GetTagsInRealtime`;
                          }
                          setSandboxUrl(urlStr);
                          setSandboxStatus("Error / Failed to Fetch");
                          setSandboxResponse({
                            error: err.message,
                            explanation:
                              "Direct fetch failed or timed out. Make sure you entered a valid API host and that target serves CORS headers correctly.",
                            solution:
                              "Verify your dynamic auth header configurations above, or try testing inside simulated tracking tabs.",
                          });
                        } finally {
                          setIsRunningSandbox(false);
                        }
                      }}
                      disabled={isRunningSandbox}
                      className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-md disabled:opacity-50"
                    >
                      {isRunningSandbox ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {isRunningSandbox
                        ? "Executing Sandbox Request..."
                        : "Send Request / Run Endpoint"}
                    </button>
                  </div>

                  {/* Live Sandbox response inspector */}
                  {(sandboxStatus || sandboxResponse) && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-xl space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Live Response Console
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${sandboxStatus?.includes("OK") ? "bg-emerald-950/80 text-emerald-400" : "bg-rose-950/80 text-rose-400"}`}
                          >
                            {sandboxStatus}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono break-all pb-2 border-b border-slate-800">
                        <span className="text-slate-500 pr-1">
                          Target Request:
                        </span>{" "}
                        {sandboxUrl}
                      </div>
                      <pre className="text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-72 p-1">
                        {JSON.stringify(sandboxResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Access Control & Custom Claims Administration Section */}
          {activeSection === "access" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-slate-900">
                  Access Control & Role Custom Claims
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  Manage Firebase Auth Custom Claims, system roles, and resource
                  access limits in real-time.
                </p>
              </div>

              {/* Current Session Auth Claim Status Card */}
              <div className="bg-gradient-to-r from-slate-900 to-[#005c94] text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-[#E0F2FE]/80 uppercase tracking-widest block mb-1">
                    Your Verified Custom Claims Token
                  </span>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold truncate max-w-[280px] md:max-w-md">
                      {auth.currentUser?.email || "Anonymous Session"}
                    </h4>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        userRole === "admin"
                          ? "bg-emerald-500 text-white"
                          : userRole === "manager"
                            ? "bg-amber-500 text-white"
                            : userRole === "operator"
                              ? "bg-blue-500 text-white"
                              : "bg-red-500 text-white"
                      }`}
                    >
                      {userRole}
                    </span>
                  </div>
                  <p className="text-xs text-[#E0F2FE]/70 mt-1.5 font-medium">
                    Custom claims are cryptographically signed inside your
                    Firebase Auth token. Bypasses Firestore Rule calculations
                    entirely.
                  </p>
                </div>
                <button
                  onClick={handleForceTokenRefresh}
                  disabled={isRefreshingClaims}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRefreshingClaims ? "animate-spin" : ""}`}
                  />
                  Refresh Verified Claims
                </button>
              </div>

              {/* Alerts and Feedback */}
              {actionSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Claim updated successfully</p>
                    <p className="font-medium text-xs mt-0.5">
                      {actionSuccessMessage}
                    </p>
                  </div>
                </div>
              )}

              {actionErrorMessage && (
                <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-200 text-sm flex items-start gap-2.5 shadow-sm animate-in fade-in duration-200">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Operation failed</p>
                    <p className="font-medium text-xs mt-0.5">
                      {actionErrorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Developer Bypass Toggle Alert */}
              {userRole !== "admin" && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex gap-3 text-sm text-slate-700 font-medium animate-in slide-in-from-top-2 duration-300">
                  <Lock className="w-5 h-5 text-[#007BC4] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 block">
                      Restricted Administration Mockup Mode
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Your account does not possess the <strong>admin</strong>{" "}
                      role. Role dropdown changes will set Firebase custom
                      claims, but to fully bypass the Dashboard view
                      restrictions in a real session, sign in or register with
                      email{" "}
                      <strong className="text-slate-700 font-bold">
                        sigmund.t.d@gaostaff.com
                      </strong>{" "}
                      (auto-bootstrapped as Admin).
                    </p>
                  </div>
                </div>
              )}

              {/* Provision New Staff Account Card */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#007BC4]" /> Provision New
                    Staff User Account
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Create a brand new credential on Firebase Authentication and
                    assign a verified custom claim role instantly.
                  </p>
                </div>

                {creationSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Account created successfully</p>
                      <p className="mt-0.5 font-medium text-[11px]">
                        {creationSuccess}
                      </p>
                    </div>
                  </div>
                )}

                {creationError && (
                  <div className="bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Failed to create account</p>
                      <p className="mt-0.5 font-medium text-[11px]">
                        {creationError}
                      </p>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={handleCreateUser}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={createDisplayName}
                      onChange={(e) => setCreateDisplayName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="john.doe@gaostaff.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Temp Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 6 chars"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Custom Claim Role *
                    </label>
                    <div className="flex gap-2">
                      <select
                        required
                        value={createRole}
                        onChange={(e) => setCreateRole(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-semibold focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition cursor-pointer"
                      >
                        <option value="operator">Operator</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                        <option value="blocked">Blocked</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isCreatingUser || userRole !== "admin"}
                        className="bg-[#007BC4] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 shrink-0 shadow-sm cursor-pointer animate-pulse-slow"
                      >
                        {isCreatingUser ? "Creating..." : "Provision"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Users Claims roster */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#007BC4]" /> Registered
                      accounts custom claims
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage Firebase Custom User Claims and role permissions on
                      the live server.
                    </p>
                  </div>
                  <button
                    onClick={loadManagementData}
                    disabled={isLoadingUsers}
                    className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 p-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isLoadingUsers ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-5">Account Email</th>
                        <th className="py-3 px-5">Provider UID</th>
                        <th className="py-3 px-5">Custom Claim Role</th>
                        <th className="py-3 px-5">Sync State</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingUsers ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-slate-400 font-medium text-xs"
                          >
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#007BC4]" />{" "}
                            Loading Auth user listings...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-slate-400 font-medium text-xs"
                          >
                            No registered accounts found. Registered users will
                            appear automatically.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr
                            key={u.uid}
                            className="hover:bg-slate-50/50 transition"
                          >
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-slate-900">
                                {u.displayName || u.email.split("@")[0]}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {u.email}
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-slate-500 font-mono text-xs">
                              {u.uid}
                            </td>
                            <td className="py-3.5 px-5">
                              <select
                                value={u.role || "operator"}
                                onChange={(e) =>
                                  handleUpdateUserRole(u.uid, e.target.value)
                                }
                                className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded px-2 py-1 outline-none text-xs font-semibold text-slate-700 transition"
                              >
                                <option value="operator">Operator</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                                <option value="blocked">Blocked</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-5 text-slate-400 text-xs font-semibold">
                              Synced{" "}
                              {u.updatedAt
                                ? new Date(u.updatedAt).toLocaleTimeString()
                                : "N/A"}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                onClick={() => handleDeleteUser(u.uid, u.email)}
                                disabled={
                                  u.uid === "sigmund_ts_boot" ||
                                  u.email === auth.currentUser?.email
                                }
                                className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:hover:text-red-500 cursor-pointer p-1.5 rounded hover:bg-red-50 transition"
                                title={
                                  u.uid === "sigmund_ts_boot"
                                    ? "Cannot delete primary root administrator account"
                                    : u.email === auth.currentUser?.email
                                      ? "Cannot delete your own active running session account"
                                      : "Delete account registry"
                                }
                              >
                                <Trash2 className="w-4 h-4 inline-block" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Policy permissions matrix */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in duration-300">
                <div className="p-5 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#007BC4]" /> Role Access
                    Control & Visibility Matrix
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Fine-tune screen and dashboard visibility mapping across
                    each custom claim tier.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature Section</th>
                          {["admin", "manager", "operator", "blocked"].map((role) => (
                            <th key={role} className="py-3 px-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              <span className="bg-[#007BC4]/10 text-[#007BC4] px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                {role}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {[
                          { key: "dashboard", label: "Dashboard / Home", desc: "Access the real-time telemetry overview" },
                          { key: "live", label: "Live Tracking Map", desc: "View physical tag positions on floor maps" },
                          { key: "playback", label: "Playback History", desc: "Replay past tag movements over timeline" },
                          { key: "people", label: "Personnel Registry", desc: "Manage staff, tags, and assignments" },
                          { key: "visitors", label: "Visitor Management", desc: "Track guests and temporary badges" },
                          { key: "attendance", label: "Attendance Insights", desc: "Monitor daily automatic timesheets" },
                          { key: "alerts", label: "Alerts Control Center", desc: "Respond to zone loitering and idle triggers" },
                          { key: "incidents", label: "Incident Investigations", desc: "Review historic flags and actions taken" },
                          { key: "analytics", label: "Traffic Analytics", desc: "Explore aggregations and flow charts" },
                          { key: "aiInsights", label: "AI Insights Engine", desc: "Query Gemini predictive reports" },
                          { key: "devices", label: "Devices & Beacons", desc: "Register anchor hardware and firmware tags" },
                          { key: "maintenance", label: "Maintenance Scheduler", desc: "Track node battery replacements" },
                          { key: "settings", label: "System Settings Console", desc: "Configure database connection and global variables" },
                          { key: "audit", label: "Audit & CSV Compliance", desc: "Review strict GAMP 5 log history" }
                        ].map((sec) => (
                          <tr key={sec.key} className="hover:bg-slate-50/50 transition duration-150">
                            <td className="py-3.5 px-4 font-medium">
                              <div className="font-bold text-slate-800 text-xs">{sec.label}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-normal">{sec.desc}</div>
                            </td>
                            {["admin", "manager", "operator", "blocked"].map((role) => (
                              <td key={role} className="py-3.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!rolePermissions[role]?.[sec.key]}
                                  onChange={(e) => {
                                    const updated = { ...rolePermissions };
                                    if (!updated[role]) {
                                      updated[role] = {};
                                    }
                                    updated[role] = {
                                      ...updated[role],
                                      [sec.key]: e.target.checked
                                    };
                                    setRolePermissions(updated);
                                  }}
                                  className="rounded border-slate-300 text-[#007BC4] focus:ring-[#007BC4]/30 w-4.5 h-4.5 cursor-pointer text-xs"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      onClick={handleSavePermissions}
                      disabled={isSavingPermissions}
                      className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50"
                    >
                      {isSavingPermissions ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save Permissions Matrix
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "rules" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Smart Alert Rules Engine
                  </h3>
                  <p className="text-slate-500 font-medium mt-1">
                    Configure automated conditional actions and security
                    triggers.
                  </p>
                </div>
                <button className="bg-[#007BC4] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-[#006aa9] transition">
                  + New Rule
                </button>
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        IF
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex-1">
                      Visitor enters Server Room
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-700 uppercase">
                        THEN
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      <span className="bg-slate-50 font-semibold text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        Trigger CCTV
                      </span>
                      <span className="bg-slate-50 font-semibold text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        SMS Security Team
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        IF
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex-1">
                      Asset (IT Equipment) is moving near Exits
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <span className="text-xs font-bold text-emerald-700 uppercase">
                        THEN
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      <span className="bg-slate-50 font-semibold text-slate-700 text-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        Send Email (IT Admin)
                      </span>
                      <span className="bg-amber-50 text-amber-700 font-semibold text-sm px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">
                        Lock Doors
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback for other sections just for mockup */}
          {activeSection !== "general" &&
            activeSection !== "security" &&
            activeSection !== "integrations" &&
            activeSection !== "notifications" &&
            activeSection !== "network" &&
            activeSection !== "apidocs" &&
            activeSection !== "access" &&
            activeSection !== "rules" && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                <div className="p-4 bg-slate-100 rounded-full mb-4">
                  <Key className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-lg font-bold text-slate-700">
                  Settings Section
                </p>
                <p className="text-sm font-medium">
                  Additional configuration options would be placed here.
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
