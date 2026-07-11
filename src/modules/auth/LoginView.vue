<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const remember = ref(true)
const reviewerPhone = ref('18627774208')
const errorMsg = ref('')

const reviewers = [
  { name: '胡喆', phone: '18627774208' },
  { name: '吴凯立', phone: '18771903739' },
  { name: '王斌林', phone: '13971005568' },
  { name: '陈支源', phone: '15623150061' },
]

function handleLogin() {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = '账号和密码不能为空！'
    return
  }
  const reviewer = reviewers.find((r) => r.phone === reviewerPhone.value)
  if (!reviewer) {
    errorMsg.value = '请选择复核人'
    return
  }
  if (reviewer.phone === username.value) {
    errorMsg.value = '查验与复核人员不能相同！'
    return
  }

  // TODO: 对接 POST /api/auth/login
  auth.login(
    {
      username: username.value,
      realName: username.value,
      phone: username.value,
      role: 1,
    },
    { phone: reviewer.phone, name: reviewer.name },
    remember.value,
  )
  router.push('/')
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <aside class="login-brand">
      <div class="brand-content">
        <h1 class="brand-title">硚孝高速王母湖收费站<br />绿通快检系统</h1>
        <p class="brand-subtitle">X透视成像 · AI大数据模型 · 创新查验机制</p>
        <ul class="brand-features">
          <li>货物智能识别，自动标定</li>
          <li>车头智能识别，安全避让</li>
          <li>北斗卫星系统，授时定位</li>
          <li>查验机制优化，提升效率</li>
        </ul>
        <p class="brand-flow">立体化核查 → 精细化管理 → 智能化决策</p>
        <p class="brand-footer">© 2025 达生智能 绿通检测系统 · 版本 v1.1.5</p>
      </div>
    </aside>

    <!-- 右侧表单区 -->
    <main class="login-form-area">
      <button class="btn-close" title="关闭" type="button">
        <img src="/assets/img/s_close.png" alt="关闭" />
      </button>

      <div class="form-wrapper">
        <h2 class="form-title">欢迎登录</h2>
        <p class="form-subtitle">请输入您的账户信息以访问系统</p>

        <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

        <label class="field-label">查验人账号</label>
        <input
          v-model="username"
          class="field-input"
          placeholder="请输入查验人账号"
          @keyup.enter="handleLogin"
        />

        <label class="field-label">密码</label>
        <input
          v-model="password"
          class="field-input"
          type="password"
          placeholder="请输入密码"
          @keyup.enter="handleLogin"
        />

        <label class="field-label">复核人</label>
        <select v-model="reviewerPhone" class="field-input field-select">
          <option v-for="r in reviewers" :key="r.phone" :value="r.phone">
            {{ r.name }}-{{ r.phone }}
          </option>
        </select>

        <div class="form-options">
          <label class="remember">
            <input v-model="remember" type="checkbox" />
            记住我
          </label>
          <a href="#" class="forgot">忘记密码？</a>
        </div>

        <button class="btn-login" @click="handleLogin">登录系统</button>

        <p class="form-help">
          需要帮助？<a href="#">联系管理员</a>
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.login-page {
  display: flex;
  width: 100vw;
  height: 100vh;
  min-width: 1010px;
  background: #fff;
}

.login-brand {
  flex: 1;
  min-width: 500px;
  background: linear-gradient(135deg, $primary 0%, $primary 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
}

.brand-content {
  max-width: 420px;
  color: #fff;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  margin-bottom: 16px;
}

.brand-subtitle {
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 32px;
}

.brand-features {
  list-style: none;
  font-size: 11pt;
  color: rgba(255, 255, 255, 0.8);
  line-height: 2;
  margin-bottom: 24px;
  padding-left: 20px;
}

.brand-flow {
  text-align: center;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 40px;
}

.brand-footer {
  text-align: center;
  font-size: 8pt;
  color: #c7c3c7;
}

.login-form-area {
  width: 510px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.btn-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  padding: 4px;
  img {
    width: 32px;
    height: 32px;
  }
}

.form-wrapper {
  width: 100%;
  max-width: 380px;
}

.form-title {
  font-size: 22px;
  font-weight: 600;
  color: #34495e;
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 10pt;
  color: $text-light;
  margin-bottom: 28px;
}

.error-box {
  background: #fff0f0;
  border: 1px solid #ffccc7;
  color: #cf1322;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.field-label {
  display: block;
  font-size: 10pt;
  font-weight: 600;
  color: $text-dark;
  margin-bottom: 6px;
  margin-top: 16px;
}

.field-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  &:focus {
    border-color: $primary;
  }
}

.field-select {
  appearance: auto;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 24px;
  font-size: 13px;
}

.remember {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $text-gray;
  cursor: pointer;
}

.forgot {
  color: $primary;
  font-size: 13px;
}

.btn-login {
  width: 100%;
  height: 48px;
  background: $primary;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  transition: background 0.2s;
  &:hover {
    background: $primary-dark;
  }
}

.form-help {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: $text-light;
  a {
    color: $primary;
    margin-left: 4px;
  }
}
</style>
