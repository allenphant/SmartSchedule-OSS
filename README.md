# SmartSchedule OSS - 智能排班系統 (開源版)

**SmartSchedule** 是一個現代化、響應式的排班管理應用程式，專為有輪班需求的中小企業（如餐飲業、零售業）設計。它簡化了員工意願登記、店長排班、防呆提醒以及工時統計的流程。

本專案使用 **Next.js 15 (App Router)**、**TypeScript**、**Tailwind CSS** 與 **Supabase** 打造。

## 🌟 核心功能亮點

*   **雙角色系統 (Manager / Staff)**：店長擁有完整排班與審核權限，員工可提報意願與請假。
*   **半月制防呆機制 (Bi-weekly Anti-error)**：首創「半月制」意願登記防呆。員工若未完成下個半月的意願登記，系統將會出現醒目紅字警告並引導填寫，大幅降低店長追班表的困擾。
*   **直覺的互動介面**：
    *   **月曆視圖 (Calendar View)**：一目瞭然的當月排班與店休狀況，包含「時數不足/超時」的智慧標示。
    *   **畫筆排班 (Brush Tool)**：店長可使用類似畫筆的拖曳方式，極速完成單日各時段的排班。
*   **Excel 一鍵匯出**：自動計算當月 FT (全職) 與 PT (兼職) 工時，並產出格式精美的 Excel 報表，方便月底結算薪資。
*   **自動鎖定機制**：可設定每月特定日期（如 13、27號）自動鎖定班表，防止員工逾期修改意願。

## 🚀 快速開始 (Quick Start)

### 1. 建立 Supabase 後端
1.  在 [Supabase](https://supabase.com/) 建立一個新專案。
2.  進入 **SQL Editor**。
3.  依序執行 `supabase/migrations/` 目錄下的所有 `.sql` 檔案（從 `001` 到最新的 migration）。這會幫你建立好所有 Table、RLS 安全性原則以及初始化函數。
4.  在 Authentication 設定中，開啟 Email 登入（若需要也可開啟 Google OAuth）。

### 2. 部署前端
你可以點擊下方按鈕直接部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2FSmartSchedule-OSS)

*   **環境變數設定**：部署時，請務必填入以下環境變數：
    *   `NEXT_PUBLIC_SUPABASE_URL`: 你的 Supabase Project URL
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 你的 Supabase Project API Key (anon/public)

### 3. 本機開發 (Local Development)
```bash
# 1. 複製環境變數範例檔
cp .env.example .env.local

# 2. 填入你的 Supabase 資訊到 .env.local 中

# 3. 安裝依賴
npm install

# 4. 啟動開發伺服器
npm run dev
```

## 🔒 隱私與安全性 (Security)
本專案的資料庫讀寫權限皆由 **Supabase RLS (Row Level Security)** 嚴格控管。
*   員工只能讀取、修改自己的排班意願。
*   店長只能讀取、修改自己所屬分店的資料。
*   所有的排班變更都會寫入 `audit_logs` 表格以供稽核。

## 📄 授權 (License)
MIT License
