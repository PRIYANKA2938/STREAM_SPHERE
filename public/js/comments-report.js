function initializeReportControl(card) {
  const bar = card.querySelector('.interaction-bar');
  if (!bar || bar.querySelector('.report-btn')) return;
  const reportButton = document.createElement('button');
  reportButton.type = 'button';
  reportButton.className = 'report-btn';
  reportButton.textContent = 'Report';
  reportButton.addEventListener('click', () => openCommentReportDialog(card, reportButton));
  bar.appendChild(reportButton);

  if (localStorage.getItem('streamsphereReported_' + card.dataset.commentId)) {
    reportButton.textContent = 'Reported';
    reportButton.disabled = true;
    markCommentReportedForReview(card);
  }
}

function markCommentReportedForReview(card) {
  const flag = card.querySelector('.comment-report-flag');
  if (!flag) return;
  flag.textContent = 'Reported for moderator review';
  flag.hidden = false;
}

let pendingCommentReport = null;

function ensureCommentReportDialog() {
  let dialog = document.getElementById('commentReportDialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'commentReportDialog';
    dialog.className = 'report-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="report-dialog-content" id="commentReportForm" style="max-width:420px;padding:20px;background:var(--card-bg, #182232);color:var(--heading, #fff);border-radius:8px;border:1px solid rgba(255,255,255,0.15);">
        <h2 style="margin:0 0 8px;font-size:18px;">Report Comment</h2>
        <p style="margin:0 0 14px;font-size:13px;color:var(--muted, #94a3b8);">Tell us what is inappropriate about this comment.</p>
        <label style="display:block;margin-bottom:12px;font-size:13px;">
          Reason
          <select id="commentReportReason" style="display:block;width:100%;margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:4px;" required>
            <option value="Inappropriate content">Inappropriate content</option>
            <option value="Harassment or abuse">Harassment or abuse</option>
            <option value="Spam or scam">Spam or scam</option>
            <option value="Hate speech">Hate speech</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label style="display:block;margin-bottom:16px;font-size:13px;">
          Details (optional)
          <textarea id="commentReportDetails" placeholder="Add more context..." style="display:block;width:100%;margin-top:6px;padding:8px;background:rgba(0,0,0,0.3);color:inherit;border:1px solid rgba(255,255,255,0.2);border-radius:4px;resize:vertical;min-height:60px;"></textarea>
        </label>
        <p id="commentReportStatus" role="status" style="display:none;color:var(--error, #f87171);font-size:13px;"></p>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" id="cancelCommentReport" style="padding:6px 14px;background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.3);border-radius:4px;cursor:pointer;">Cancel</button>
          <button type="submit" style="padding:6px 14px;background:#e50914;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Submit Report</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    document.getElementById('cancelCommentReport').addEventListener('click', closeCommentReportDialog);
    document.getElementById('commentReportForm').addEventListener('submit', handleCommentReportSubmit);
  }
  return dialog;
}

function openCommentReportDialog(card, reportButton) {
  const reportKey = 'streamsphereReported_' + card.dataset.commentId;
  if (localStorage.getItem(reportKey)) {
    reportButton.textContent = 'Reported';
    reportButton.disabled = true;
    markCommentReportedForReview(card);
    return;
  }
  pendingCommentReport = { card, reportButton };
  const dialog = ensureCommentReportDialog();
  const reasonEl = document.getElementById('commentReportReason');
  const detailsEl = document.getElementById('commentReportDetails');
  if (reasonEl) reasonEl.value = 'Inappropriate content';
  if (detailsEl) detailsEl.value = '';

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.classList.add('is-open');
}

function closeCommentReportDialog() {
  const dialog = document.getElementById('commentReportDialog');
  if (dialog && dialog.open) dialog.close();
  if (dialog) dialog.classList.remove('is-open');
  pendingCommentReport = null;
}

async function handleCommentReportSubmit(event) {
  event.preventDefault();
  if (!pendingCommentReport) return;
  const { card, reportButton } = pendingCommentReport;
  const reason = document.getElementById('commentReportReason').value;
  const details = document.getElementById('commentReportDetails').value.trim();
  const finalReason = details ? reason + ': ' + details : reason;
  const form = document.getElementById('commentReportForm');
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.getElementById('commentReportStatus');
  const currentText = card.dataset.originalComment || card.querySelector('.comment-text')?.textContent.trim() || '';
  submitButton.disabled = true;
  status.style.display = 'none';
  status.textContent = '';
  try {
    const response = await fetch('/api/comments/' + encodeURIComponent(card.dataset.commentId) + '/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporterId: typeof getViewerId === 'function' ? getViewerId() : 'guest',
        reason: finalReason,
        videoId: document.getElementById('videoId')?.value || 'celestial-anomaly-ep4',
        username: card.querySelector('.username')?.textContent.trim() || 'Guest User',
        text: currentText,
        timestamp: card.querySelector('.timestamp')?.dataset.timestamp || new Date().toISOString(),
        language: card.dataset.language || 'en'
      })
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Unable to submit this report.');
    }
    localStorage.setItem('streamsphereReported_' + card.dataset.commentId, 'true');
    card.dataset.reportCount = String(Number(card.dataset.reportCount || 0) + 1);
    reportButton.textContent = 'Reported';
    reportButton.disabled = true;
    markCommentReportedForReview(card);
    closeCommentReportDialog();
  } catch (error) {
    status.textContent = error.message || 'Unable to submit this report. Please try again.';
    status.style.display = 'block';
    console.error('Comment report failed:', error);
  } finally {
    submitButton.disabled = false;
  }
}
