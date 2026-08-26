import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Button,
  ButtonGroup,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import GridView from '@mui/icons-material/GridView';
import ViewList from '@mui/icons-material/ViewList';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Download from '@mui/icons-material/Download';
import Share from '@mui/icons-material/Share';
import Delete from '@mui/icons-material/Delete';
import VideoLibrary from '@mui/icons-material/VideoLibrary';
import Collections from '@mui/icons-material/Collections';
import Add from '@mui/icons-material/Add';
import Edit from '@mui/icons-material/Edit';
import MoreVert from '@mui/icons-material/MoreVert';
import CalendarToday from '@mui/icons-material/CalendarToday';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import Refresh from '@mui/icons-material/Refresh';
import Sort from '@mui/icons-material/Sort';
import FilterList from '@mui/icons-material/FilterList';
import Folder from '@mui/icons-material/Folder';
import FolderOpen from '@mui/icons-material/FolderOpen';
import { VideoStudioLayout } from '../../VideoStudioLayout';
import { useContentAssets, AssetFilters, ContentAsset } from '../../../../hooks/useContentAssets';
import { useCollections, Collection } from '../../../../hooks/useCollections';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}


const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />;
    case 'processing':
      return <HourglassEmpty sx={{ color: '#f59e0b', fontSize: 18 }} />;
    case 'failed':
      return <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />;
    default:
      return <HourglassEmpty sx={{ color: '#6b7280', fontSize: 18 }} />;
  }
};

export const LibraryVideo: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  const urlSourceModule = searchParams.get('source_module');
  const urlAssetType = searchParams.get('asset_type');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tabValue, setTabValue] = useState(0);
  const [filterType, setFilterType] = useState(() => {
    if (urlAssetType) {
      return urlAssetType === 'video' ? 'videos' : 'all';
    }
    return 'videos'; // Default to videos for Video Studio
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [anchorEl, setAnchorEl] = useState<{ [key: number]: HTMLElement | null }>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Collections state
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  
  const {
    collections,
    loading: collectionsLoading,
    createCollection,
    deleteCollection,
    addAssetsToCollection,
    removeAssetsFromCollection,
    refetch: refetchCollections,
  } = useCollections();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters
  const filters: AssetFilters = useMemo(() => {
    const baseFilters: AssetFilters = {
      limit: pageSize,
      offset: page * pageSize,
    };

    if (urlSourceModule) {
      baseFilters.source_module = urlSourceModule as any;
    } else {
      // Default to video_studio sources for Video Studio
      baseFilters.source_module = 'main_video_generation';
    }

    if (debouncedSearch) {
      baseFilters.search = debouncedSearch;
    }

    if (filterType === 'videos') {
      baseFilters.asset_type = 'video';
    } else if (filterType === 'favorites') {
      baseFilters.favorites_only = true;
    }

    if (tabValue === 1) {
      baseFilters.favorites_only = true;
    }

    return baseFilters;
  }, [debouncedSearch, filterType, tabValue, page, pageSize, urlSourceModule]);

  // Update filters when collection is selected
  const collectionFilters: AssetFilters = useMemo(() => {
    const baseFilters = { ...filters };
    if (selectedCollection !== null) {
      baseFilters.collection_id = selectedCollection;
    }
    if (sortBy) {
      baseFilters.sort_by = sortBy;
    }
    if (sortOrder) {
      baseFilters.sort_order = sortOrder;
    }
    return baseFilters;
  }, [filters, selectedCollection, sortBy, sortOrder]);

  const { assets, loading, error, total, toggleFavorite, deleteAsset, trackUsage, refetch } = useContentAssets(collectionFilters);
  
  // Use assets directly since backend now filters by collection_id
  const filteredAssets = assets;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssets(new Set(assets.map(a => a.id)));
    } else {
      setSelectedAssets(new Set());
    }
  };

  const handleSelectAsset = (assetId: number, checked: boolean) => {
    const newSelected = new Set(selectedAssets);
    if (checked) {
      newSelected.add(assetId);
    } else {
      newSelected.delete(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.size === 0) return;
    if (!window.confirm(`Delete ${selectedAssets.size} selected asset(s)?`)) return;
    
    try {
      await Promise.all(Array.from(selectedAssets).map(id => deleteAsset(id)));
      setSelectedAssets(new Set());
      setSnackbar({ open: true, message: `${selectedAssets.size} asset(s) deleted`, severity: 'success' });
      refetch();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete assets', severity: 'error' });
    }
  };

  const handleBulkDownload = async () => {
    if (selectedAssets.size === 0) return;
    
    try {
      const selectedAssetsData = assets.filter(a => selectedAssets.has(a.id));
      await Promise.all(selectedAssetsData.map(asset => trackUsage(asset.id, 'download')));
      
      selectedAssetsData.forEach(asset => {
        window.open(asset.file_url, '_blank');
      });
      
      setSnackbar({ open: true, message: `Downloading ${selectedAssets.size} asset(s)`, severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to download assets', severity: 'error' });
    }
  };

  const handleFavorite = async (assetId: number) => {
    try {
      await toggleFavorite(assetId);
      const asset = assets.find(a => a.id === assetId);
      setSnackbar({
        open: true,
        message: asset?.is_favorite ? 'Removed from favorites' : 'Added to favorites',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to update favorite', severity: 'error' });
    }
  };

  const handleDelete = async (assetId: number) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;
    try {
      await deleteAsset(assetId);
      setSnackbar({ open: true, message: 'Asset deleted', severity: 'success' });
      refetch();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete asset', severity: 'error' });
    }
  };

  const handleDownload = async (asset: ContentAsset) => {
    try {
      await trackUsage(asset.id, 'download');
      window.open(asset.file_url, '_blank');
    } catch (err) {
      console.error('Error downloading:', err);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    try {
      await createCollection({
        name: newCollectionName,
        description: newCollectionDescription,
        is_public: false,
      });
      
      setCollectionDialogOpen(false);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setSnackbar({ open: true, message: 'Collection created', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to create collection', severity: 'error' });
    }
  };

  const handleAddToCollection = async (collectionId: number) => {
    if (selectedAssets.size === 0) return;
    
    try {
      await addAssetsToCollection(collectionId, Array.from(selectedAssets));
      setSelectedAssets(new Set());
      setSnackbar({ open: true, message: 'Assets added to collection', severity: 'success' });
      refetch();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to add assets to collection', severity: 'error' });
    }
  };

  const handleRemoveFromCollection = async (assetId: number) => {
    if (!selectedCollection) return;
    
    try {
      await removeAssetsFromCollection(selectedCollection, [assetId]);
      setSnackbar({ open: true, message: 'Asset removed from collection', severity: 'success' });
      refetch();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to remove asset from collection', severity: 'error' });
    }
  };

  const handleDeleteCollection = async (collectionId: number) => {
    if (!window.confirm('Are you sure you want to delete this collection? Assets will not be deleted.')) return;
    
    try {
      await deleteCollection(collectionId);
      if (selectedCollection === collectionId) {
        setSelectedCollection(null);
      }
      setSnackbar({ open: true, message: 'Collection deleted', severity: 'success' });
      refetch();
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to delete collection', severity: 'error' });
    }
  };

  return (
    <VideoStudioLayout
      headerProps={{
        title: 'Asset Library',
        subtitle: 'Manage and organize all your video assets. Search, filter, create collections, and track usage.',
      }}
    >
      <Box sx={{ width: '100%' }}>
        {/* Search and Filter Bar */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                fullWidth
                placeholder="Search videos by title, description, prompt, or filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="created_at">Date Created</MenuItem>
                  <MenuItem value="updated_at">Last Updated</MenuItem>
                  <MenuItem value="cost">Cost</MenuItem>
                  <MenuItem value="file_size">File Size</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                </Select>
              </FormControl>
              <ButtonGroup size="small">
                <Button
                  variant={sortOrder === 'desc' ? 'contained' : 'outlined'}
                  onClick={() => setSortOrder('desc')}
                >
                  Newest
                </Button>
                <Button
                  variant={sortOrder === 'asc' ? 'contained' : 'outlined'}
                  onClick={() => setSortOrder('asc')}
                >
                  Oldest
                </Button>
              </ButtonGroup>
              <ButtonGroup size="small">
                <Button
                  variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('grid')}
                  startIcon={<GridView />}
                >
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('list')}
                  startIcon={<ViewList />}
                >
                  List
                </Button>
              </ButtonGroup>
            </Stack>

            {/* Collections Sidebar */}
            <Stack direction="row" spacing={2}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  minWidth: 250,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Collections
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setCollectionDialogOpen(true)}
                    sx={{ color: '#3b82f6' }}
                  >
                    <Add />
                  </IconButton>
                </Stack>
                <Stack spacing={1}>
                  <Button
                    fullWidth
                    variant={selectedCollection === null ? 'contained' : 'outlined'}
                    startIcon={<VideoLibrary />}
                    onClick={() => setSelectedCollection(null)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    All Videos
                  </Button>
                  {collections.map((collection) => (
                    <Button
                      key={collection.id}
                      fullWidth
                      variant={selectedCollection === collection.id ? 'contained' : 'outlined'}
                      startIcon={<Folder />}
                      onClick={() => setSelectedCollection(collection.id)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      <Box sx={{ flex: 1, textAlign: 'left' }}>{collection.name}</Box>
                      <Chip label={collection.asset_count} size="small" sx={{ ml: 1 }} />
                    </Button>
                  ))}
                </Stack>
              </Paper>

              {/* Main Content Area */}
              <Box sx={{ flex: 1 }}>
                <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
                  <Tab label="All Videos" />
                  <Tab label="Favorites" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : error ? (
                    <Alert severity="error" action={<Button onClick={refetch}>Retry</Button>}>
                      {error}
                    </Alert>
                  ) : filteredAssets.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                      <VideoLibrary sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No videos found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {searchQuery ? 'Try adjusting your search query' : 'Your video assets will appear here'}
                      </Typography>
                    </Paper>
                  ) : (
                    <>
                      {/* Bulk Actions */}
                      {selectedAssets.size > 0 && (
                        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {selectedAssets.size} selected
                            </Typography>
                            <Button size="small" onClick={handleBulkDownload} startIcon={<Download />}>
                              Download
                            </Button>
                            <Button size="small" color="error" onClick={handleBulkDelete} startIcon={<Delete />}>
                              Delete
                            </Button>
                            <Divider orientation="vertical" flexItem />
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                              <InputLabel>Add to Collection</InputLabel>
                              <Select
                                value=""
                                label="Add to Collection"
                                onChange={(e) => handleAddToCollection(Number(e.target.value))}
                              >
                                {collections.map((collection) => (
                                  <MenuItem key={collection.id} value={collection.id}>
                                    {collection.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Stack>
                        </Paper>
                      )}

                      {/* Grid View */}
                      {viewMode === 'grid' ? (
                        <Grid container spacing={2}>
                          {filteredAssets.map((asset) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={asset.id}>
                              <Card
                                sx={{
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  border: selectedAssets.has(asset.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                }}
                              >
                                <Box sx={{ position: 'relative' }}>
                                  <Checkbox
                                    checked={selectedAssets.has(asset.id)}
                                    onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                                    sx={{
                                      position: 'absolute',
                                      top: 8,
                                      left: 8,
                                      zIndex: 1,
                                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    }}
                                  />
                                  <CardMedia
                                    component="video"
                                    src={asset.file_url}
                                    sx={{
                                      height: 200,
                                      backgroundColor: '#000',
                                      objectFit: 'contain',
                                    }}
                                    controls
                                  />
                                  <IconButton
                                    sx={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                      color: '#fff',
                                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
                                    }}
                                    size="small"
                                    onClick={(e) => setAnchorEl({ ...anchorEl, [asset.id]: e.currentTarget })}
                                  >
                                    <MoreVert />
                                  </IconButton>
                                </Box>
                                <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {asset.title || asset.filename}
                                  </Typography>
                                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                    {asset.model && (
                                      <Chip label={asset.model} size="small" variant="outlined" />
                                    )}
                                    {asset.cost > 0 && (
                                      <Chip label={`$${asset.cost.toFixed(4)}`} size="small" variant="outlined" />
                                    )}
                                  </Stack>
                                </CardContent>
                                <Box sx={{ p: 1, borderTop: '1px solid #e2e8f0' }}>
                                  <Stack direction="row" spacing={1} justifyContent="space-between">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleFavorite(asset.id)}
                                      color={asset.is_favorite ? 'error' : 'default'}
                                    >
                                      {asset.is_favorite ? <Favorite /> : <FavoriteBorder />}
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDownload(asset)}>
                                      <Download />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDelete(asset.id)}>
                                      <Delete />
                                    </IconButton>
                                  </Stack>
                                </Box>
                                <Menu
                                  anchorEl={anchorEl[asset.id]}
                                  open={Boolean(anchorEl[asset.id])}
                                  onClose={() => setAnchorEl({ ...anchorEl, [asset.id]: null })}
                                >
                                  <MenuItem onClick={() => handleDownload(asset)}>
                                    <ListItemIcon><Download fontSize="small" /></ListItemIcon>
                                    <ListItemText>Download</ListItemText>
                                  </MenuItem>
                                  <MenuItem onClick={() => handleFavorite(asset.id)}>
                                    <ListItemIcon>
                                      {asset.is_favorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                                    </ListItemIcon>
                                    <ListItemText>{asset.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</ListItemText>
                                  </MenuItem>
                                  {selectedCollection && (
                                    <MenuItem onClick={() => handleRemoveFromCollection(asset.id)}>
                                      <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
                                      <ListItemText>Remove from Collection</ListItemText>
                                    </MenuItem>
                                  )}
                                  <Divider />
                                  <MenuItem onClick={() => handleDelete(asset.id)}>
                                    <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                                    <ListItemText>Delete</ListItemText>
                                  </MenuItem>
                                </Menu>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : (
                        /* List View */
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={selectedAssets.size === assets.length && assets.length > 0}
                                    indeterminate={selectedAssets.size > 0 && selectedAssets.size < assets.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                  />
                                </TableCell>
                                <TableCell>Video</TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Model</TableCell>
                                <TableCell>Cost</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredAssets.map((asset) => (
                                <TableRow key={asset.id} hover>
                                  <TableCell padding="checkbox">
                                    <Checkbox
                                      checked={selectedAssets.has(asset.id)}
                                      onChange={(e) => handleSelectAsset(asset.id, e.target.checked)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <video
                                      src={asset.file_url}
                                      style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 4 }}
                                      controls
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight={600}>
                                      {asset.title || asset.filename}
                                    </Typography>
                                    {asset.description && (
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        {asset.description}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {asset.model && <Chip label={asset.model} size="small" />}
                                  </TableCell>
                                  <TableCell>${asset.cost.toFixed(4)}</TableCell>
                                  <TableCell>
                                    {new Date(asset.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                      <IconButton size="small" onClick={() => handleFavorite(asset.id)}>
                                        {asset.is_favorite ? <Favorite color="error" /> : <FavoriteBorder />}
                                      </IconButton>
                                      <IconButton size="small" onClick={() => handleDownload(asset)}>
                                        <Download />
                                      </IconButton>
                                      <IconButton size="small" color="error" onClick={() => handleDelete(asset.id)}>
                                        <Delete />
                                      </IconButton>
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}

                      {/* Pagination */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of {total} videos
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            disabled={(page + 1) * pageSize >= total}
                            onClick={() => setPage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </Stack>
                      </Box>
                    </>
                  )}
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  {/* Favorites tab - same content as All Videos but filtered */}
                  <Typography>Favorites view (same as above with favorites_only filter)</Typography>
                </TabPanel>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {/* Create Collection Dialog */}
        <Dialog open={collectionDialogOpen} onClose={() => setCollectionDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Collection</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Collection Name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Description (optional)"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCollectionDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreateCollection}
              disabled={!newCollectionName.trim()}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
        />
      </Box>
    </VideoStudioLayout>
  );
};

export default LibraryVideo;
