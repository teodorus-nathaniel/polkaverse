import {
  HomeOutlined,
  LikeOutlined,
  MessageOutlined,
  ShareAltOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { nonEmptyStr } from '@subsocial/utils'
import { summarize } from '@subsocial/utils/summarize'
import Link from 'next/link'
import React from 'react'
import { NAME_MAX_LEN } from 'src/config/ValidationsConfig'
import messages from 'src/messages'
import { useSelectPost, useSelectProfile, useSelectSpace } from 'src/rtk/app/hooks'
import { Activity, asCommentData, asSharedPostStruct, EventsName, PostData } from 'src/types'
import { useMyAddress } from '../auth/MyAccountsContext'
import ViewPostLink from '../posts/ViewPostLink'
import Avatar from '../profiles/address-views/Avatar'
import Name from '../profiles/address-views/Name'
import { ViewSpace } from '../spaces/ViewSpace'
import { equalAddresses } from '../substrate'
import { accountUrl, postUrl, spaceUrl } from '../urls'
import { formatDate } from '../utils'
import { DfBgImageLink } from '../utils/DfBgImg'
import { MutedDiv } from '../utils/MutedText'
import { Pluralize } from '../utils/Plularize'
import { NotifActivitiesType } from './Notifications'
import { EventsMsg, PathLinks } from './types'

type NotificationMessageProps = {
  msg: string
  aggregationCount: number
  withAggregation?: boolean
}

type PostTitleForActivityProps = {
  post: PostData
}
const PostTitleForActivity = React.memo(({ post: { content } }: PostTitleForActivityProps) => {
  if (!content) return null // ? Maybe use some text? Example: 'link' or 'see here'

  const { title, summary } = content

  return <>{title || summarize(summary, { limit: NAME_MAX_LEN })}</>
})

const NotificationMessage = ({
  msg,
  aggregationCount,
  withAggregation = true,
}: NotificationMessageProps) => {
  const aggregationMsg = withAggregation
    ? aggregationCount > 0 && (
        <>
          {' and '}
          <Pluralize
            count={aggregationCount}
            singularText='other person'
            pluralText='other people'
          />
        </>
      )
    : undefined

  return (
    <>
      {aggregationMsg} {msg}&nbsp;
    </>
  )
}

type NotificationProps = Activity & {
  type: NotifActivitiesType
}

type InnerNotificationProps = NotificationProps &
  PathLinks & {
    preview: React.ReactNode
    entityOwner?: string
    msg?: string
    image?: string
  }

const iconProps = {
  className: 'DfNotificationIcon',
}

const iconByEvent: Record<string, React.ReactNode> = {
  AccountFollowed: <UserAddOutlined {...iconProps} />,
  SpaceFollowed: <UserAddOutlined {...iconProps} />,
  SpaceCreated: <HomeOutlined {...iconProps} />,
  PostCreated: <ShareAltOutlined {...iconProps} />,
  CommentCreated: <MessageOutlined {...iconProps} />,
  CommentReplyCreated: <MessageOutlined {...iconProps} />,
  PostShared: <ShareAltOutlined {...iconProps} />,
  CommentShared: <ShareAltOutlined {...iconProps} />,
  PostReactionCreated: <LikeOutlined {...iconProps} />,
  CommentReactionCreated: <LikeOutlined {...iconProps} />,
}

export function InnerNotification(props: InnerNotificationProps) {
  const myAddress = useMyAddress()
  const {
    preview,
    entityOwner,
    type,
    image = '',
    links,
    msg: customMsg,
    aggCount,
    event,
    account,
    date,
  } = props
  const owner = useSelectProfile(account.toString())

  const avatar = owner?.content?.image

  const msgType: NotifActivitiesType = equalAddresses(myAddress, entityOwner) ? type : 'activities'

  const eventMsg = messages[msgType] as EventsMsg

  const icon = iconByEvent[event]

  return (
    <Link {...links}>
      <div className='DfNotificationItem'>
        <div className='DfNotificationIcons'>
          {icon}
          <Avatar address={account} avatar={avatar} />
        </div>
        <div className='DfNotificationContent'>
          <div className='DfTextActivity'>
            <Name owner={owner} address={account} />
            <span className='DfActivityMsg'>
              <NotificationMessage
                msg={customMsg || eventMsg[event]}
                aggregationCount={aggCount}
                withAggregation={msgType === 'notifications'}
              />
              {preview}
            </span>
          </div>
          <MutedDiv className='DfDate'>{formatDate(date)}</MutedDiv>
        </div>
        {nonEmptyStr(image) && <DfBgImageLink {...links} src={image} size={80} />}
      </div>
    </Link>
  )
}

const SpaceNotification = (props: NotificationProps) => {
  const { spaceId } = props
  const space = useSelectSpace(spaceId)

  if (!space) return null

  return (
    <InnerNotification
      preview={<ViewSpace spaceData={space} nameOnly withLink />}
      image={space.content?.image}
      entityOwner={space.struct.ownerId}
      links={{
        href: '/[spaceId]',
        as: spaceUrl(space.struct),
      }}
      {...props}
    />
  )
}

const AccountNotification = (props: NotificationProps) => {
  const { followingId } = props
  const profile = useSelectProfile(followingId)

  if (!profile) return null

  const address = profile.struct.ownerId
  return (
    <InnerNotification
      preview={<Name owner={profile} address={address} />}
      image={profile.content?.image}
      entityOwner={address}
      links={{
        href: '/[spaceId]',
        as: accountUrl({ address }),
      }}
      {...props}
    />
  )
}

const PostNotification = (props: NotificationProps) => {
  const { postId, event } = props
  const postDetails = useSelectPost(postId)

  let originalPostId = ''
  if (postDetails && postDetails.post.struct.isSharedPost) {
    const sharedPost = asSharedPostStruct(postDetails?.post.struct)
    originalPostId = sharedPost.originalPostId
  }
  const sharedPostOriginal = useSelectPost(originalPostId)

  if (!postDetails) return null

  const { post } = postDetails
  const { isSharedPost } = post.struct

  let space = postDetails.space!
  let msg: string | undefined = undefined
  let content = post.content

  const links = {
    href: '/[spaceId]/[slug]',
    as: postUrl(space!, post),
  }

  if (isSharedPost && sharedPostOriginal && event === 'PostCreated') {
    msg = messages['activities'].PostSharing
    const originalPost = sharedPostOriginal?.post
    space = sharedPostOriginal.space!
    content = originalPost.content
    links.as = postUrl(space, originalPost)
  }

  return (
    <InnerNotification
      preview={
        <ViewPostLink
          post={post}
          space={space?.struct}
          title={<PostTitleForActivity post={post} />}
        />
      }
      image={content?.image}
      entityOwner={post.struct.ownerId}
      msg={msg}
      links={links}
      {...props}
    />
  )
}

const CommentNotification = (props: NotificationProps) => {
  const { commentId } = props
  const commentDetails = useSelectPost(commentId)

  const rootPostId = commentDetails
    ? asCommentData(commentDetails.post).struct.rootPostId
    : undefined
  const postDetails = useSelectPost(rootPostId)

  if (!postDetails) return null

  const { post, space } = postDetails

  const links = {
    href: '/[spaceId]/[slug]',
    as: postUrl(space!, post),
  }

  return (
    <InnerNotification
      preview={
        <ViewPostLink
          post={post}
          space={space!.struct}
          title={<PostTitleForActivity post={post} />}
        />
      }
      image={post.content?.image}
      entityOwner={post.struct.ownerId}
      links={links}
      {...props}
    />
  )
}

export const Notification = React.memo((props: NotificationProps) => {
  const { event, type } = props
  const isActivity = type === 'activities'
  const eventName = event as EventsName

  switch (eventName) {
    case 'AccountFollowed':
      return <AccountNotification {...props} />
    case 'SpaceFollowed':
      return <SpaceNotification {...props} />
    case 'SpaceCreated':
      return <SpaceNotification {...props} />
    case 'CommentCreated':
      return <CommentNotification {...props} />
    case 'CommentReplyCreated':
      return <CommentNotification {...props} />
    case 'PostShared':
      return isActivity ? null : <PostNotification {...props} />
    case 'CommentShared':
      return <CommentNotification {...props} />
    case 'PostReactionCreated':
      return <PostNotification {...props} />
    case 'CommentReactionCreated':
      return <CommentNotification {...props} />
    case 'PostCreated':
      return isActivity ? <PostNotification {...props} /> : null
    default:
      return null
  }
})

export default Notification
