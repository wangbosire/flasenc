import { Loader2 } from 'lucide-react'
import type { PlatformContentListItem } from '@/api/platform-contents'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusText } from '@/features/contents/content-admin-display'
import {
  LISTING_STATE_OPTIONS,
  PUBLISH_STATUS_OPTIONS,
} from '@/features/contents/content-list.model'

export function ContentsPermissionDialog({
  open,
  item,
  publishStatus,
  listingState,
  onPublishStatusChange,
  onListingStateChange,
  onDismiss,
  onSave,
  isSaving,
}: {
  open: boolean
  item: PlatformContentListItem | null
  publishStatus: string
  listingState: string
  onPublishStatusChange: (v: string) => void
  onListingStateChange: (v: string) => void
  onDismiss: () => void
  onSave: () => void
  isSaving: boolean
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑内容权限</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='publish-status'>发布态</Label>
            <Select value={publishStatus} onValueChange={onPublishStatusChange}>
              <SelectTrigger id='publish-status'>
                <SelectValue placeholder='选择发布态' />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    <StatusText kind='publishStatus' value={status} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='listing-state'>上架态</Label>
            <Select value={listingState} onValueChange={onListingStateChange}>
              <SelectTrigger id='listing-state'>
                <SelectValue placeholder='选择上架态' />
              </SelectTrigger>
              <SelectContent>
                {LISTING_STATE_OPTIONS.map((state) => (
                  <SelectItem key={state} value={state}>
                    <StatusText kind='listingState' value={state} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onDismiss}>
            取消
          </Button>
          <Button disabled={!item || isSaving} onClick={onSave}>
            {isSaving ? <Loader2 className='animate-spin' /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
