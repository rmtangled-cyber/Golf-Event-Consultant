import { ApiError } from '@/api/index.ts';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'group_submitted':
        return 'この組はすでに提出済みです。修正は幹事に連絡してください。';
      case 'event_final':
        return '結果が確定したため、入力できません。';
      case 'incomplete':
        return '全員の18ホールを入力してから提出してください。';
      case 'invalid_token':
        return 'リンクが無効です。幹事に新しいリンクをもらってください。';
      case 'forbidden':
        return 'この操作の権限がありません。';
      case 'login_required':
        return '幹事としてログインしてください。';
      case 'network':
        return '通信できません。電波の良い場所で再度お試しください。';
      default:
        return error.message || 'エラーが発生しました。';
    }
  }
  return 'エラーが発生しました。';
}

export const nowIso = () => new Date().toISOString();
