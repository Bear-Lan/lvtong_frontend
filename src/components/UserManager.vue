<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { request } from '@/api/request'

interface User {
  username: string
  real_name: string
  phone: string
  role: number
}

const users = ref<User[]>([])
const loading = ref(false)
const editing = ref(false)
const editUser = ref({ username: '', real_name: '', password: '', role: 1, phone: '' })
const isNew = ref(true)

async function fetchUsers() {
  loading.value = true
  try {
    const res = await request<User[]>('/user/query?username=all')
    if (res.code === 0 && res.data) {
      users.value = res.data
    }
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isNew.value = true
  editUser.value = { username: '', real_name: '', password: '', role: 1, phone: '' }
  editing.value = true
}

function openEdit(user: User) {
  isNew.value = false
  editUser.value = { ...user, password: '' }
  editing.value = true
}

async function saveUser() {
  const { username, real_name, password, role, phone } = editUser.value
  if (!username || !real_name) return

  const res = await request(`/user/update/${username}`, {
    method: 'POST',
    body: JSON.stringify({ real_name, password, role, phone }),
  })
  if (res.code === 0) {
    editing.value = false
    fetchUsers()
  } else {
    alert(res.message)
  }
}

async function deleteUser(username: string) {
  if (!confirm(`确定删除用户 ${username}？`)) return
  const res = await request(`/user/delete/${username}`, { method: 'DELETE' })
  if (res.code === 0) {
    fetchUsers()
  } else {
    alert(res.message)
  }
}

const roles: Record<number, string> = { 0: '普通用户', 1: '管理员', 2: '超级管理员' }

onMounted(fetchUsers)
</script>

<template>
  <div class="user-mgr">
    <div class="header-row">
      <h2>用户管理</h2>
      <button class="btn-add" @click="openAdd">+ 新增用户</button>
    </div>

    <table class="data-table" v-if="users.length">
      <thead>
        <tr>
          <th>用户名</th>
          <th>姓名</th>
          <th>电话</th>
          <th>角色</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.username">
          <td>{{ u.username }}</td>
          <td>{{ u.real_name }}</td>
          <td>{{ u.phone || '--' }}</td>
          <td>{{ roles[u.role] ?? u.role }}</td>
          <td>
            <button class="btn-edit" @click="openEdit(u)">编辑</button>
            <button class="btn-del" @click="deleteUser(u.username)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!loading" class="empty">暂无用户</div>

    <!-- 编辑弹窗 -->
    <div v-if="editing" class="modal-overlay" @click.self="editing = false">
      <div class="modal">
        <h3>{{ isNew ? '新增用户' : '编辑用户' }}</h3>
        <div class="form">
          <label>
            用户名
            <input v-model="editUser.username" :disabled="!isNew" placeholder="登录账号" />
          </label>
          <label>
            姓名
            <input v-model="editUser.real_name" placeholder="真实姓名" />
          </label>
          <label>
            密码
            <input v-model="editUser.password" type="password" :placeholder="isNew ? '设置密码' : '留空则不修改'" />
          </label>
          <label>
            电话
            <input v-model="editUser.phone" placeholder="手机号" />
          </label>
          <label>
            角色
            <select v-model.number="editUser.role">
              <option :value="0">普通用户</option>
              <option :value="1">管理员</option>
              <option :value="2">超级管理员</option>
            </select>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="editing = false">取消</button>
          <button class="btn-save" @click="saveUser">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-mgr {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 { font-size: 20px; }

  .btn-add {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    background: #1677ff;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
  }
  th { background: #fafafa; font-weight: 600; }
  tr:hover { background: #f5f5f5; }
}

.btn-edit, .btn-del {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid #ddd;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
}
.btn-edit { color: #1677ff; border-color: #1677ff; }
.btn-del { color: #ff4d4f; border-color: #ff4d4f; }
.empty { text-align: center; padding: 60px; color: #999; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;

  h3 { margin-bottom: 16px; }
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: #666;
  }
  input, select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    &:focus { border-color: #4096ff; outline: none; }
  }
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;

  button {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .btn-cancel { background: #f0f0f0; color: #333; }
  .btn-save { background: #1677ff; color: #fff; }
}
</style>
