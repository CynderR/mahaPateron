import { useLocation } from 'react-router-dom';
import { FeedPost } from '../components/PostCard';
import { buildStreamState, currentPathWithSearch } from '../utils/streamNavigation';

export const useStreamLinkState = (post?: FeedPost) => {
  const location = useLocation();
  return buildStreamState(currentPathWithSearch(location.pathname, location.search), post);
};
