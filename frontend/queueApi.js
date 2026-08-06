'use strict';

const ACTIVE_QUEUE_API_URL = '/api/active-queues';

function getQueueAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  const isAdminPage =
    window.location.pathname === '/admin' ||
    window.location.pathname.endsWith('/admin.html');

  
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  
  const userId = isAdminPage
    ? localStorage.getItem('userId') || '1'
    : localStorage.getItem('userId');

  const role = isAdminPage
    ? 'administrator'
    : localStorage.getItem('role');

  if (userId) {
    headers['x-user-id'] = userId;
  }

  if (role) {
    headers['x-user-role'] = role;
  }

  return headers;
}

async function queueApiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getQueueAuthHeaders(),
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error?.message ||
        result.message ||
        'Queue request failed.'
    );
  }

  return result.data;
}

async function getActiveQueues(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return queueApiRequest(`${ACTIVE_QUEUE_API_URL}${query}`);
}

async function getActiveQueueById(queueId) {
  return queueApiRequest(`${ACTIVE_QUEUE_API_URL}/${queueId}`);
}

async function getOpenQueueForService(serviceId) {
  return queueApiRequest(
    `${ACTIVE_QUEUE_API_URL}/service/${serviceId}/open`
  );
}

async function createActiveQueue(serviceId, status = 'open') {
  return queueApiRequest(ACTIVE_QUEUE_API_URL, {
    method: 'POST',
    body: JSON.stringify({ serviceId, status })
  });
}

async function updateActiveQueueStatus(queueId, status) {
  return queueApiRequest(
    `${ACTIVE_QUEUE_API_URL}/${queueId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }
  );
}

// Makes the functions available to existing frontend scripts.
window.QueueApi = {
  getActiveQueues,
  getActiveQueueById,
  getOpenQueueForService,
  createActiveQueue,
  updateActiveQueueStatus
};
